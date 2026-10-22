export function shouldDismissMobileSidebar(
  key: string,
  focusIsInsideMenu: boolean
) {
  return key === "Escape" && !focusIsInsideMenu
}
