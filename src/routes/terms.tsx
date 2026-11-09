import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy/policy-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | WoPhoto" },
      {
        name: "description",
        content: "Terms for accessing and using WoPhoto studio workspaces.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
        <li>upload malicious code or try to bypass security, access controls, or limits;</li>
        <li>
          probe, scan, or test the vulnerability of the system, or disrupt service for other users; or
        </li>
        <li>
          use the AI Copilot to generate unlawful, defamatory, harassing, or abusive content, or to
          intentionally evade provider terms or safety systems.
        </li>
      </ul>

      <h2>Availability and changes</h2>
      <p>
        WoPhoto is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. Features,
        models, storage limits, and third-party integrations may be updated, modified, or retired
        over time. While we work to keep the service dependable, uninterrupted operation is not
        guaranteed. Your studio is encouraged to keep independent backups of original media and
        essential records.
      </p>

      <h2>AI features</h2>
      <p>
        The AI Copilot offers conversational assistance, drafting, and workflow suggestions based
        on current workspace context and configured models. AI output may occasionally be
        inaccurate, incomplete, or out of date. Always review suggestions, assignments, dates, and
        deliverable details before making decisions or publishing work.
      </p>

      <h2>Termination</h2>
      <p>
        A studio manager may end your access at any time. You may stop using the application at any
        time. Sections concerning content responsibility, acceptable use, and limitations survive
        termination.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your workspace access or project assignments should be directed to your
        studio manager. For inquiries about the WoPhoto software or this policy, please reach out
        through your studio&apos;s administrator.
      </p>
    </PolicyPage>
  );
}
