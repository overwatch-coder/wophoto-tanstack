import { describe, expect, it } from "vitest";
import { decodeActionArguments, encodeActionArguments } from "@/lib/server-action-args";

describe("TanStack server function argument codec", () => {
  it("preserves form fields and uploaded files across the server function boundary", async () => {
    const formData = new FormData();
    formData.set("title", "Reference files");
    formData.set("file", new File(["photo bytes"], "reference.jpg", { type: "image/jpeg" }));

    const args: [FormData, string] = [formData, "extra"];
    const encoded = await encodeActionArguments(args);
    const [decodedFormData, extra] = decodeActionArguments<typeof args>(encoded);

    expect(extra).toBe("extra");
    expect(decodedFormData.get("title")).toBe("Reference files");
    const file = decodedFormData.get("file");
    expect(file).toBeInstanceOf(File);
    if (file && typeof file !== "string") {
      expect(file.name).toBe("reference.jpg");
      expect(await file.text()).toBe("photo bytes");
    }
  });
});
