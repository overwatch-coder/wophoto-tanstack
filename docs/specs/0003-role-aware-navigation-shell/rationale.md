# 0003. Role Aware Navigation Shell · Decision record

## Context

WoPhoto has Google sign in, role checks, and a manager invitation page. After sign in, there is not yet a shared workspace layout to help people move between the features planned for the MVP.

Managers, workers, and clients need different destinations. Several destinations will be built in later slices, so the shell must communicate what is available without sending people to unfinished pages. It also needs to work on phones, where a permanent sidebar would leave too little room for the page.

The existing Auth.js session supplies the user identity and role. The existing orange theme, light and dark modes, shadcn components, and invitation route remain the project conventions. This feature does not change authentication or the data model.

## Options considered

### Option 1: Shared shell with the shadcn sidebar

Use one reusable workspace layout, a role based navigation configuration, and the shadcn sidebar components. The layout adapts to a collapsible desktop rail and a phone drawer.

**Pros**:

1. Uses the component library already chosen for WoPhoto and the requested `sidebar-07` icon collapsing block.
2. Keeps the three roles visually consistent while allowing different destinations.
3. The sidebar component already handles common layout and accessibility details.

**Cons**:

1. The navigation configuration must stay aligned with server side role checks.
2. A shared layout requires care so page specific controls do not accumulate in the top bar.

### Option 2: Separate layout for each role

Build a manager, worker, and client layout independently, each with its own navigation and top bar.

**Pros**:

1. Each role can change independently as its workflows grow.
2. Role specific layout rules are explicit.

**Cons**:

1. Common behavior such as theme, account controls, and responsive navigation is duplicated.
2. Visual differences and maintenance work grow as the shell changes.

### Option 3: One custom navigation built from basic elements

Build the sidebar and drawer directly with custom CSS and browser events rather than using the shadcn sidebar.

**Pros**:

1. Gives full control over markup and behavior.
2. Adds no additional component generator work.

**Cons**:

1. Reimplements responsive, keyboard, and focus behavior that an existing component can provide.
2. Creates a second navigation pattern outside the project's chosen component system.

## Rationale

The project already uses shadcn components and has three roles that share the same product. One shell avoids repeating account, theme, and mobile behavior while keeping each role's destinations explicit. Separate layouts would add code that has no current product benefit, while custom navigation would recreate behavior that the chosen component library already supports.

Disabled future entries make the planned areas discoverable without leading to empty pages. The manager invitations route is the only current workspace destination, so managers can keep using it while the other role pages arrive in later slices. Role checks remain on server pages and actions, which prevents a hidden link from becoming the only access control.
