import { AdvancedAnalysis } from '@/components/AdvancedAnalysis';
import { Masthead } from '@/components/Masthead';
import { Footer } from '@/components/Footer';

export default function AnalysisPage() {
  return (
    <div className="min-h-screen">
      <Masthead date={null} />
      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <AdvancedAnalysis />
      </main>
      <Footer />
    </div>
  );
}
