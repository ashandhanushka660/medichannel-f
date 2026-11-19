import Link from "next/link";
import Workspace from "@/components/common/workspace";

export default function ConsultationPage() {
  return (
    <Workspace
      role="patient"
      title="Online Consultation"
      description="Access your private online consultation with your treating doctor."
    >
      <div className="card">
        <h2 className="text-lg font-bold">Private Consultation Room</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your room opens when your doctor starts the consultation. Only you and
          your assigned doctor can read or send messages, and the chat becomes
          read-only when the consultation ends.
        </p>
        <p className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          Chat, typing indicators, live status and consultation summaries are
          available in the{" "}
          <Link className="font-semibold underline" href="/mediclinic-system.html#consult">
            full patient consultation window
          </Link>
          .
        </p>
      </div>
    </Workspace>
  );
}
