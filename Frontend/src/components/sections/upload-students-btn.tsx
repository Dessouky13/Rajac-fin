import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_CF } from "@/lib/api";
import { Upload } from "lucide-react";

export function UploadStudentsButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_CF}/students/upload`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.success) {
        const { studentsAdded, studentsUpdated, duplicatesFound } = data.data;
        
        let message = `Processing complete!\n`;
        message += `• ${studentsAdded} new students added\n`;
        
        if (duplicatesFound > 0) {
          message += `• ${duplicatesFound} duplicates found and updated\n`;
          message += `  (Updated fees and subject count only)`;
        }

        toast({
          title: "Students Import Successful",
          description: message,
          variant: "default"
        });
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
      <Button 
        onClick={handleFileSelect} 
        disabled={loading} 
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {loading ? "Uploading..." : "Upload Students"}
      </Button>
    </>
  );
}