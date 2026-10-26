import type { Metadata } from "next"
import { PolicyPage } from "@/components/policy/policy-page"

export const metadata: Metadata = {
  title: "Terms of Use | WoPhoto",
  description: "Terms for accessing and using WoPhoto studio workspaces.",
}

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of Use">
      <p>
        These terms describe use of the WoPhoto application for photography and multimedia studio
        workflows. Your studio may also have separate agreements or instructions that apply to its
        projects and information.
      </p>

      <h2>Access to WoPhoto</h2>
      <p>
        WoPhoto uses invitation-based Google sign-in. You may use a workspace only through an
        account invited or approved by that studio. Keep your Google account secure, use your own
        account, and tell the studio manager if you believe someone else has accessed it.
      </p>

      <h2>Studio roles and administration</h2>
      <p>
        Managers invite members, assign roles, manage projects, and control settings such as
        Copilot access. Your available features and the information you can see depend on your role
        and project access. A manager may suspend or remove your workspace access when your
        participation is no longer authorized.
      </p>

      <h2>Your content</h2>
      <p>
        You or your studio retain responsibility for content uploaded or entered into WoPhoto,
        including photographs, client information, briefs, project files, and comments. You must
        have the rights and permissions needed to use that content and to share it with the people
        who can access the workspace.
      </p>
      <p>
        You allow WoPhoto and the providers needed to operate it to host, store, process, and display
        this content only as needed to provide the workspace features you and your studio use.
        Studio managers are responsible for choosing who receives access and for handling studio
        content in line with their agreements with clients and team members.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use WoPhoto to:</p>
      <ul>
        <li>break the law or violate another person&apos;s privacy, intellectual-property, or publicity rights;</li>
        <li>upload malware, attempt to bypass access controls, or interfere with the service;</li>
        <li>access a project or another person&apos;s account without authorization; or</li>
        <li>use AI features to make decisions about people without appropriate review and authorization.</li>
      </ul>

      <h2>Copilot and third-party services</h2>
      <p>
        Copilot is available only when enabled for your account by the studio&apos;s settings. Prompts,
        attachments, and relevant workspace context may be sent to the AI provider selected by the
        studio or member. AI output can be incomplete or incorrect. Review it before relying on it,
        sharing it with a client, or confirming a proposed action. Google sign-in, AI providers,
        hosting, database, and file-storage services are subject to their own terms and policies.
      </p>

      <h2>Service availability and changes</h2>
      <p>
        WoPhoto may be updated, changed, or temporarily unavailable while the service is maintained.
        No specific uptime or support response time is promised by these terms. Features may change
        as the service develops; your studio manager will determine whether and how those features
        are used in the workspace.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        A studio manager may revoke invitations, disable Copilot access, or suspend a member&apos;s
        account. If your access ends, contact the studio manager about any project information you
        need to retain. Workspace records may remain available to the studio after an individual
        member loses access.
      </p>

      <h2>Questions</h2>
      <p>
        For help with access, studio records, or these terms, contact the manager who invited you.
        The manager can provide the correct organization and service contact details for your
        workspace.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        These terms may be updated as WoPhoto changes. The revision date at the top of this page
        shows when the current text was published. Your studio may also provide notices or separate
        service agreements that apply to your use of its workspace.
      </p>
    </PolicyPage>
  )
}
