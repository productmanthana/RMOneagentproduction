import { useState, useEffect } from "react";

const processingSteps = [
  { message: "RMOne AI Agents are evaluating your query", timing: "~5-10 sec" },
  { message: "Analyzing your question with AI", timing: "~5-8 sec" },
  { message: "Querying the database", timing: "~3-6 sec" },
  { message: "Generating insights and visualizations", timing: "~5-8 sec" },
  { message: "Almost there, preparing your results", timing: "~3-5 sec" },
  { message: "This query involves multiple agents working together — thank you for your patience", timing: "" },
];

export function TypingIndicator() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        // Stop at the last step, don't cycle back
        if (prev >= processingSteps.length - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, 6000); // 6 seconds per step

    return () => {
      clearInterval(stepInterval);
    };
  }, []);

  const currentStep = processingSteps[stepIndex];

  return (
    <div className="flex flex-col gap-2 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border border-[#E5E7EB] shadow-sm px-5 py-4 rounded-2xl w-fit ml-4" data-testid="typing-indicator">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#8BC34A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2.5 h-2.5 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2.5 h-2.5 bg-[#F59E0B] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          <div className="w-2.5 h-2.5 bg-[#EC4899] rounded-full animate-bounce" style={{ animationDelay: '450ms' }}></div>
        </div>
        <span className="text-sm font-medium text-[#374151] transition-opacity duration-300">
          {currentStep.message}
        </span>
      </div>
      <div className="text-xs text-[#6B7280] pl-12">
        <span>Step {stepIndex + 1} of {processingSteps.length}{currentStep.timing ? ` (${currentStep.timing})` : ''}</span>
      </div>
    </div>
  );
}
