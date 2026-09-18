import React from "react";
import { X, ShieldAlert } from "lucide-react";

interface TermsDisclaimerProps {
  role: "customer" | "artisan";
  onClose: () => void;
}

export default function TermsDisclaimer({ role, onClose }: TermsDisclaimerProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-white brutal-border brutal-shadow-md w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-[var(--color-brutal-red)] border-b-4 border-black p-4 sm:p-6 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-black" />
            <h2 className="text-2xl font-black text-black uppercase tracking-tighter">Security Disclaimer & Terms</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white brutal-border flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none"
          >
            <X className="w-6 h-6 text-black stroke-[3]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto font-medium text-black text-sm sm:text-base leading-relaxed">
          {role === "customer" ? (
            <div className="space-y-6">
              <h3 className="text-xl font-black uppercase bg-[var(--color-brutal-yellow)] inline-block px-2 border-2 border-black -rotate-1">Customer Terms of Service</h3>
              
              <p>
                By registering for and using the NEED platform, you explicitly acknowledge and agree to the following terms regarding security, liability, and platform usage. NEED serves solely as an introductory conduit connecting independent service professionals ("Technicians") with users seeking services.
              </p>
              
              <p className="font-bold border-l-4 border-[var(--color-brutal-red)] pl-4">
                1. Assumption of Risk and Safety Precautions
                You acknowledge that inviting any third-party Technician into your home, office, or designated location carries inherent risks. While NEED implements certain screening protocols (such as identity and police clearance verification for Technicians), we cannot absolutely guarantee the safety, conduct, or intent of any independent Technician. You assume all risks associated with utilizing services procured through our platform. You are strongly advised to independently verify the Technician’s identity upon arrival, ensure another adult is present during the service provision, and secure all valuables.
              </p>

              <p>
                2. Limitation of Platform Liability
                NEED, its affiliates, directors, and employees, shall under no circumstances be held liable for any direct, indirect, incidental, punitive, or consequential damages arising from the actions, negligence, or misconduct of any Technician. We do not employ the Technicians; they are independent contractors. Any dispute regarding property damage, theft, bodily injury, or unsatisfactory service quality must be resolved directly with the Technician.
              </p>

              <p>
                3. Data Usage and Privacy
                By utilizing NEED, you consent to the collection and transmission of your personal data—including but not limited to your precise location data, phone number, and name—to Technicians for the sole purpose of fulfilling your job requests. You acknowledge that providing inaccurate location data may result in the inability to receive services or accurate pricing.
              </p>

              <p>
                By proceeding, you confirm that you have read, fully understand, and unconditionally accept these terms.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-xl font-black uppercase bg-[var(--color-brutal-blue)] inline-block px-2 border-2 border-black -rotate-1">Technician Terms of Service</h3>
              
              <p>
                By registering as a Technician on the NEED platform, you explicitly acknowledge and agree to the following terms regarding your status, security obligations, liability, and behavioral standards.
              </p>
              
              <p className="font-bold border-l-4 border-[var(--color-brutal-red)] pl-4">
                1. Independent Contractor Status
                You acknowledge that you are an independent contractor and not an employee, agent, or partner of NEED. You are solely responsible for providing your own tools, managing your own schedule, and remitting any applicable taxes. NEED serves strictly as a lead generation and matchmaking platform.
              </p>

              <p>
                2. Liability and Quality of Work
                You are strictly liable for the quality of the services you provide, any damages caused to a customer's property, and any bodily injury resulting from your work. NEED assumes absolutely no liability for your actions. In the event of a dispute, claim, or legal action initiated by a customer resulting from your conduct or workmanship, you agree to fully indemnify and hold NEED harmless.
              </p>

              <p>
                3. Security, Background Checks, and Police Clearance
                To ensure platform safety, you must consent to comprehensive background checks. You are strictly required to upload a valid, up-to-date Police Clearance Certificate during onboarding. NEED reserves the right to suspend or permanently terminate your account without notice if we detect fraudulent documents, if you receive reports of aggressive or unprofessional behavior, or if you attempt to circumvent the platform's payment ecosystem.
              </p>

              <p>
                4. Data Sharing and Privacy
                You consent to NEED displaying your profile, certifications, ratings, and location data to customers to facilitate job matching. You agree to utilize customer data (such as phone numbers and addresses) strictly for the purpose of completing the assigned job and not for external marketing or harassment.
              </p>

              <p>
                By proceeding, you confirm that you have read, fully understand, and unconditionally accept these terms.
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t-4 border-black p-4 sm:p-6 bg-[var(--color-brutal-bg)] flex justify-end">
          <button 
            onClick={onClose}
            className="bg-black text-white font-black px-8 py-3 uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-y-0 active:shadow-none"
          >
            I Understand
          </button>
        </div>

      </div>
    </div>
  );
}
