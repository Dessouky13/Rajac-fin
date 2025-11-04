import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ProcessDriveStudentsButton } from "@/components/sections/process-drive-students-btn";
import { UploadStudentsButton } from "@/components/sections/upload-students-btn";
import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import rajacLogo from "@/assets/rajac-logo-hd.png";
import { downloadMasterSheet, deleteAllData, updateInstallments } from "@/lib/api";
import { adminUndo, fetchAdminActions, undoAction } from "@/lib/api";
import { RotateCw } from 'lucide-react';

export function Header() {
  const { isArabic, setIsArabic, t } = useLanguage();

  const toggleLanguage = () => {
    setIsArabic(!isArabic);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className={`flex items-center space-x-4 ${isArabic ? 'space-x-reverse' : ''}`}>
          <div className="h-14 w-14 flex items-center justify-center scale-in bg-primary/10 rounded-lg border border-primary/20">
            <img 
              src={rajacLogo} 
              alt="RAJAC Language Schools Logo" 
              className="h-12 w-12 object-contain"
            />
          </div>
          <div className="slide-up">
            <h1 className="text-2xl font-bold text-primary">
              {t("نظام المالية", "Financial System")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("مدارس راجاك للغات", "RAJAC Language Schools")}
            </p>
          </div>
        </div>
        
        <div className={`flex items-center space-x-3 ${isArabic ? 'space-x-reverse' : ''}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2 hover:scale-105 transition-transform"
          >
            <Languages className="h-4 w-4" />
            <span className="text-sm">
              {isArabic ? "English" : "العربية"}
            </span>
          </Button>
          {/* Admin dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hover:bg-accent/50">
                <MoreHorizontal className="h-4 w-4" />
                <span className="ml-2 text-sm">Admin</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={async () => { await downloadMasterSheet(); }}>
                Download Master Sheet (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { if (confirm('Delete ALL data? This cannot be undone.')) { await deleteAllData(); alert('All data deleted'); } }}>
                Delete All Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                const dates = prompt('Enter installment dates as comma-separated YYYY-MM-DD (e.g. 2025-10-15,2025-12-15,2026-02-15)');
                if (dates) {
                  const arr = dates.split(',').map((d) => d.trim()).filter(Boolean).map((d, i) => ({ number: i+1, date: d }));
                  await updateInstallments(arr);
                  alert('Installment dates updated');
                }
              }}>
                Insert/Update Installment Dates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={async () => {
            // Fetch last 3 actions and let the admin choose which one to undo.
            const resp = await fetchAdminActions(3);
            if (!resp.ok || !resp.data) { alert('Failed to fetch recent actions'); return; }
            const actions = resp.data as any[];
            if (!actions || actions.length === 0) { alert('No recent actions to undo'); return; }
            // Build a simple selection prompt
            const options = actions.map((a, i) => `${i+1}. ${a.actionType} - ${a.refId} (${a.ts})`).join('\n');
            const choice = prompt(`Select action to undo by number:\n${options}\nEnter 1-${actions.length} or Cancel`);
            if (!choice) return;
            const idx = Number(choice) - 1;
            if (isNaN(idx) || idx < 0 || idx >= actions.length) { alert('Invalid selection'); return; }
            const action = actions[idx];
            if (!confirm(`Are you sure you want to undo: ${action.actionType} (${action.refId})?`)) return;
            const undoRes = await undoAction(action.actionId);
            if (undoRes.ok) {
              alert('Action reverted');
              try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch(e) {}
            } else {
              alert('Revert failed: ' + (undoRes.message || 'Unknown error'));
            }
          }} className="hover:scale-105">
            <RotateCw className="h-4 w-4" />
            <span className="text-sm">Undo</span>
          </Button>
          <UploadStudentsButton />
          <ProcessDriveStudentsButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}