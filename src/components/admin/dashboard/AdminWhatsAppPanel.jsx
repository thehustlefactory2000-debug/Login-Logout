import React from "react";
import WhatsAppTestPanel from "../WhatsAppTestPanel";
import { AdminShellCard, PanelHeader } from "./adminDashboardShared";

const AdminWhatsAppPanel = () => (
  <AdminShellCard>
    <PanelHeader eyebrow="Messaging Console" title="WhatsApp tools" description="Use the existing test panel from the redesigned admin shell." />
    <div className="p-4 sm:p-6">
      <WhatsAppTestPanel />
    </div>
  </AdminShellCard>
);

export default AdminWhatsAppPanel;
