'use client';

import { MessageCircle } from 'lucide-react';

interface WhatsAppWidgetProps {
  groupLink: string;
}

export default function WhatsAppWidget({ groupLink }: WhatsAppWidgetProps) {
  const handleClick = () => {
    window.open(groupLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      className="whatsapp-widget fixed bottom-6 left-6 w-14 h-14 rounded-full bg-success hover:bg-[#128C7E] shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50"
      aria-label="הצטרף לקבוצת WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white fill-white" />
    </button>
  );
}
