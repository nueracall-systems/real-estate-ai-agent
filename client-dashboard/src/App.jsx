import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import WhatsAppConnect from './pages/WhatsAppConnect.jsx';
import Home from './pages/Home.jsx';
import Properties from './pages/Properties.jsx';
import Leads from './pages/Leads.jsx';
import Conversations from './pages/Conversations.jsx';
import QuickSend from './pages/QuickSend.jsx';
import BulkSend from './pages/BulkSend.jsx';
import EmergencyBlock from './pages/EmergencyBlock.jsx';
import Appointments from './pages/Appointments.jsx';
import Templates from './pages/Templates.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/whatsapp" element={<WhatsAppConnect />} />
      <Route path="/" element={<Home />} />
      <Route path="/properties" element={<Properties />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/conversations" element={<Conversations />} />
      <Route path="/quick-send" element={<QuickSend />} />
      <Route path="/bulk-send" element={<BulkSend />} />
      <Route path="/emergency-block" element={<EmergencyBlock />} />
      <Route path="/appointments" element={<Appointments />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
