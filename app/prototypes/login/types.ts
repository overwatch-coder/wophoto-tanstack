export type LoginSimulatedState =
  | "normal"
  | "invite-accepted"
  | "invite-invalid"
  | "error-suspended"
  | "error-mismatch";

export type PrototypeVersion = "version-a" | "version-b" | "version-c";

export interface VersionProps {
  state: LoginSimulatedState;
  onStateChange: (state: LoginSimulatedState) => void;
}
