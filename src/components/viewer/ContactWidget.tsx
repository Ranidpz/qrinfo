'use client';

import { useState, useEffect } from 'react';
import { Phone, Mail, MessageCircle, MapPin } from 'lucide-react';

type WidgetType = 'phone' | 'email' | 'sms' | 'navigation';

interface PhoneConfig {
  enabled: boolean;
  phoneNumber: string;
}

interface EmailConfig {
  enabled: boolean;
  email: string;
  subject?: string;
  body?: string;
}

interface SmsConfig {
  enabled: boolean;
  phoneNumber: string;
  message?: string;
}

interface NavigationConfig {
  enabled: boolean;
  address: string;
  app: 'google' | 'waze';
}

type WidgetConfig = PhoneConfig | EmailConfig | SmsConfig | NavigationConfig;

interface ContactWidgetProps {
  type: WidgetType;
  config: WidgetConfig;
  onTrackClick?: () => void;
  position?: 'bottom-left' | 'bottom-right';
  offset?: number; // Vertical offset in pixels
}

// Widget metadata
const widgetMeta: Record<WidgetType, {
  icon: typeof Phone;
  color: string;
  hoverColor: string;
  shadowColor: string;
}> = {
  phone: {
    icon: Phone,
    color: '#3B82F6', // blue-500
    hoverColor: '#2563EB', // blue-600
    shadowColor: 'rgba(59, 130, 246, 0.3)',
  },
  email: {
    icon: Mail,
    color: '#EF4444', // red-500
    hoverColor: '#DC2626', // red-600
    shadowColor: 'rgba(239, 68, 68, 0.3)',
  },
  sms: {
    icon: MessageCircle,
    color: '#8B5CF6', // purple-500
    hoverColor: '#7C3AED', // purple-600
    shadowColor: 'rgba(139, 92, 246, 0.3)',
  },
  navigation: {
    icon: MapPin,
    color: '#10B981', // emerald-500
    hoverColor: '#059669', // emerald-600
    shadowColor: 'rgba(16, 185, 129, 0.3)',
  },
};

export default function ContactWidget({
  type,
  config,
  onTrackClick,
  position = 'bottom-left',
  offset = 0,
}: ContactWidgetProps) {
  const [isVisible, setIsVisible] = useState(false);

  const meta = widgetMeta[type];
  const Icon = meta.icon;

  // Show widget after 1 second delay with bounce animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    onTrackClick?.();

    let url = '';

    switch (type) {
      case 'phone': {
        const phoneConfig = config as PhoneConfig;
        url = `tel:+${phoneConfig.phoneNumber}`;
        break;
      }
      case 'email': {
        const emailConfig = config as EmailConfig;
        url = `mailto:${emailConfig.email}`;
        const params: string[] = [];
        if (emailConfig.subject) {
          params.push(`subject=${encodeURIComponent(emailConfig.subject)}`);
        }
        if (emailConfig.body) {
          params.push(`body=${encodeURIComponent(emailConfig.body)}`);
        }
        if (params.length > 0) {
          url += `?${params.join('&')}`;
        }
        break;
      }
      case 'sms': {
        const smsConfig = config as SmsConfig;
        url = `sms:+${smsConfig.phoneNumber}`;
        if (smsConfig.message) {
          url += `?body=${encodeURIComponent(smsConfig.message)}`;
        }
        break;
      }
      case 'navigation': {
        const navConfig = config as NavigationConfig;
        const encodedAddress = encodeURIComponent(navConfig.address);
        if (navConfig.app === 'waze') {
          url = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
        } else {
          url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }
        break;
      }
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isVisible) return null;

  const positionClasses = position === 'bottom-right'
    ? 'right-6'
    : 'left-6';

  return (
    <>
      <style jsx global>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(20px);
          }
          50% {
            opacity: 1;
            transform: scale(1.1) translateY(-5px);
          }
          70% {
            transform: scale(0.9) translateY(2px);
          }
          100% {
            transform: scale(1) translateY(0);
          }
        }
        .animate-bounceIn {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }
      `}</style>
      <button
        onClick={handleClick}
        className={`contact-widget fixed ${positionClasses} w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 z-50 animate-bounceIn`}
        style={{
          backgroundColor: meta.color,
          boxShadow: `0 10px 15px -3px ${meta.shadowColor}, 0 4px 6px -4px ${meta.shadowColor}`,
          bottom: `${24 + offset}px`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = meta.hoverColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = meta.color;
        }}
        aria-label={type}
      >
        <Icon className="w-7 h-7 text-white" />
      </button>
    </>
  );
}
