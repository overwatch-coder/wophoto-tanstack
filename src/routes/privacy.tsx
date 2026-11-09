import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy/policy-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | WoPhoto" },
      {
        name: "description",
        content: "Learn what information WoPhoto processes and how studio workspace data is used.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
      <p>Workspace information is used only to operate the studio tools, including to:</p>
      <ul>
        <li>authenticate members and display the right projects and tasks for their role;</li>
        <li>send task reminders, review requests, and notifications to crew members and clients;</li>
        <li>track studio equipment check-outs, maintenance, and availability;</li>
        <li>provide optional AI Copilot assistance when requested by authorized team members; and</li>
        <li>support audit logging, abuse prevention, and basic app maintenance.</li>
      </ul>

      <h2>AI providers and processing</h2>
      <p>
        When you use the AI Copilot, your prompt, conversation turn, and relevant project context
        are sent to the configured AI provider (Google Gemini, Anthropic Claude, OpenAI, or Groq)
        to generate a response. Workspace owners configure which providers and models are allowed.
        WoPhoto does not sell your prompts or studio content.
      </p>

      <h2>Sharing and service providers</h2>
      <p>
        Information in a workspace is visible to other members of that studio according to their
        role and permissions. WoPhoto relies on infrastructure providers to run the application,
        including:
      </p>
      <ul>
        <li>Google Sign-In for authentication;</li>
        <li>PostgreSQL database hosting for workspace records;</li>
        <li>blob storage for uploaded studio files and avatars;</li>
        <li>configured AI provider APIs for Copilot requests; and</li>
        <li>SMTP email delivery for invitation and notification messages.</li>
      </ul>

      <h2>Data retention and access</h2>
      <p>
        Studio workspace data is kept for as long as the studio maintains the workspace. Managers
        may archive tasks, close projects, remove invitations, and suspend member accounts. When
        an account is deleted, personal profile information is removed or anonymized while
        historical project records needed for studio integrity are preserved.
      </p>

      <h2>Security</h2>
      <p>
        WoPhoto uses HTTPS encryption in transit, role-based authorization for all workspace areas,
        and secure session management. We recommend using two-factor authentication on the Google
        account you use to sign in.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as new studio features are added. The updated version will always
        be available at this address with an updated revision date.
      </p>

      <h2>Contact</h2>
      <p>
        If you have questions about this policy or how your studio uses WoPhoto, please contact your
        studio manager.
      </p>
    </PolicyPage>
  );
}
