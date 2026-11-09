export type EncodedFile = {
  __tanstackFile: true;
  name: string;
  type: string;
  lastModified: number;
  bytes: Uint8Array;
};

export type EncodedFormDataValue = string | EncodedFile;
export type EncodedActionArgument<T> = T extends FormData
  ? { __tanstackFormData: Array<[string, EncodedFormDataValue]> }
  : T;

export type EncodedActionArguments<T extends unknown[]> = {
  [Index in keyof T]: EncodedActionArgument<T[Index]>;
};

export async function encodeActionArguments<T extends unknown[]>(args: T): Promise<EncodedActionArguments<T>> {
  return Promise.all(args.map(async (arg) => {
    if (arg instanceof FormData) {
      const entries = await Promise.all(Array.from(arg.entries(), async ([key, value]) => {
        if (typeof value === "string") return [key, value] as const;
        return [key, {
          __tanstackFile: true as const,
          name: value.name,
          type: value.type,
          lastModified: value.lastModified,
          bytes: new Uint8Array(await value.arrayBuffer()),
        }] as const;
      }));
      return { __tanstackFormData: entries };
    }
    return arg;
  })) as EncodedActionArguments<T>;
}

export function decodeActionArguments<T extends unknown[]>(args: EncodedActionArguments<T>): T {
  return args.map((arg) => {
    if (
      arg &&
      typeof arg === "object" &&
      "__tanstackFormData" in arg &&
      Array.isArray(arg.__tanstackFormData)
    ) {
      const formData = new FormData();
      for (const [key, value] of arg.__tanstackFormData) {
        if (typeof value === "string") {
          formData.append(key, value);
        } else if (value.__tanstackFile === true) {
          formData.append(key, new File([value.bytes], value.name, {
            type: value.type,
            lastModified: value.lastModified,
          }));
        }
      }
      return formData;
    }
    return arg;
  }) as T;
}
