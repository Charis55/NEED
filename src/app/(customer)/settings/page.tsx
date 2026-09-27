import SharedSettings from "@/components/SharedSettings";
import AuthGate from "@/components/AuthGate";

export default function CustomerSettingsPage() {
  return (
    <AuthGate title="Sign in to view settings">
      <SharedSettings isArtisan={false} />
    </AuthGate>
  );
}
