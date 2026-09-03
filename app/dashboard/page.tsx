import { Masthead } from '@/components/Masthead';
import { Dashboard } from '@/components/Dashboard';
import { Footer } from '@/components/Footer';

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Masthead date={null} />
      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <Dashboard />
      </main>
      <Footer />
    </div>
  );
}
