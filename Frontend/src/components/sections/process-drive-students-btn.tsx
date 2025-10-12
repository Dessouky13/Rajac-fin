import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_CF } from "@/lib/api";

export function ProcessDriveStudentsButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleProcess = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_CF}/students/process-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        let message = `${data.filesProcessed} file(s) processed successfully.`;
        
        // If the response includes duplicate information, show it
        if (data.duplicatesFound && data.duplicatesFound > 0) {
          message += `\n• ${data.studentsAdded || 0} new students added`;
          message += `\n• ${data.duplicatesFound} duplicates updated (fees & subjects only)`;
        }

        toast({
          title: "Drive Import Complete",
          description: message,
        });
      } else {
        toast({
          title: "Drive Import Failed",
          description: data.error || "Unknown error",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Drive Import Error",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  return (
    <Button onClick={handleProcess} disabled={loading} className="bg-primary hover:bg-primary/90">
      {loading ? "Processing..." : "Import Students from Drive"}
    </Button>
  );
}
