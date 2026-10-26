import type { Metadata } from "next"
import { PolicyPage } from "@/components/policy/policy-page"

export const metadata: Metadata = {
  title: "Privacy Policy | WoPhoto",
  description: "Learn what information WoPhoto processes and how studio workspace data is used.",
}

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Policy">
      <p>
        WoPhoto helps photography and multimedia studios coordinate projects, tasks, schedules,
        creative briefs, client feedback, equipment, and shared files. This policy describes the
        information the app processes to provide those features.
      </p>

      <h2>Who manages your workspace data</h2>
      <p>
        WoPhoto workspaces are created and administered by a studio manager. The studio decides
        who is invited, what project information is entered, and which team members can see it.
        For questions about a particular project record or a request to access, correct, or remove
        workspace information, start with the manager who invited you. They can also identify the
        organization responsible for your workspace and provide its privacy contact details.
      </p>

      <h2>Information WoPhoto processes</h2>
      <ul>
        <li>
          <strong>Account and sign-in information:</strong> name, email address, profile image,
          account role and status, and the Google account and session information needed to sign in.
        </li>
        <li>
          <strong>Studio workspace content:</strong> projects, tasks, assignments, comments, client
          feedback, schedules, work requests, creative briefs and sign-offs, brand assets, inventory
          records, and notifications entered or generated while using the app.
        </li>
        <li>
          <strong>Preferences and administration:</strong> theme, workspace density, notification
          preferences, profile settings, Copilot access choices, and selected AI provider and model.
        </li>
        <li>
          <strong>Copilot usage records:</strong> when Copilot is enabled, the app records the
          workspace member, role, provider, model, and request time to enforce the studio&apos;s daily
          usage limit. WoPhoto does not currently maintain a separate saved chat-transcript library.
        </li>
        <li>
          <strong>Files:</strong> profile pictures and studio files uploaded to features such as
          brand assets and creative briefs. Copilot attachments are processed to answer the request;
          the app does not create a permanent chat attachment library.
        </li>
      </ul>

      <h2>How information is used</h2>
      <p>
        WoPhoto uses this information to authenticate invited members, operate studio workflows,
        show records to authorized workspace members, deliver notifications, store uploaded files,
        enforce manager-selected access and usage limits, and maintain the service&apos;s security and
        reliability. WoPhoto does not sell workspace information or use it for targeted advertising.
      </p>

      <h2>When information is shared</h2>
      <ul>
        <li>
          <strong>Within your studio:</strong> records are visible to managers, workers, and clients
          according to their role, project membership, and the access controls in the app. Managers
          administer invitations and workspace permissions.
        </li>
        <li>
          <strong>Sign-in and hosting providers:</strong> Google is used for sign-in. The app also
          relies on hosting, database, and file-storage providers to run the service and store
          workspace records and uploads.
        </li>
        <li>
          <strong>AI providers:</strong> if Copilot is enabled and used, the prompt, any attached
          files, and the relevant studio information needed to answer the request may be sent to the
          provider and model selected in Settings. The connection may use a key supplied by the
          studio manager or a member&apos;s own key. The AI provider&apos;s own terms and privacy practices
          also apply to data it receives.
        </li>
      </ul>
      <p>
        The current deployment&apos;s provider names, processing regions, and provider-specific retention
        terms depend on the studio and service configuration. Ask your studio manager which
        providers are configured for your workspace.
      </p>

      <h2>Access, security, and retention</h2>
      <p>
        WoPhoto uses role and project access checks, authenticated sessions, and private storage for
        profile photos. Provider API keys saved in the app are encrypted before they are stored.
        These measures reduce risk but cannot guarantee that any online service is completely
        secure.
      </p>
      <p>
        WoPhoto does not currently publish one retention period for every workspace. Managers can
        delete or archive many records in the app; soft-deleted tasks remain in the deleted-task
        archive until permanently removed. Some records are kept while needed to operate the
        workspace, and infrastructure providers may retain backup copies under their own schedules.
        Ask your studio manager about the retention practices for your workspace.
      </p>

      <h2>Your choices and privacy requests</h2>
      <p>
        You can update some profile and preference information in Settings. Depending on the laws
        that apply to you, you may also have rights to request access to, correction of, deletion of,
        or a copy of personal information, or to object to or restrict certain processing. Contact
        your studio manager to make a request or ask for the correct privacy contact for the
        organization responsible for your workspace. The manager may need to verify your identity
        and coordinate the request with the service operator or providers.
      </p>

      <h2>Cookies and local preferences</h2>
      <p>
        WoPhoto uses cookies required for sign-in and session security. It also stores certain
        display preferences, such as theme and sidebar state, so the workspace can remember your
        choices. This app does not currently use advertising cookies.
      </p>

      <h2>Children</h2>
      <p>
        WoPhoto is designed for professional studio workspaces and is not intended for children to
        use independently. Studio managers should invite only people who are permitted to use their
        workspace.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If WoPhoto&apos;s data practices change, this page will be updated with a new revision date.
        Your studio manager may also provide workspace-specific notices.
      </p>
    </PolicyPage>
  )
}
