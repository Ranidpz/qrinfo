'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, MapPin, Users, CheckCircle2, Loader2, AlertCircle, Download, Calendar } from 'lucide-react';

interface RegistrationData {
  id: string;
  codeId: string;
  cellId: string;
  visitorId: string;
  nickname: string;
  phone: string;
  count: number;
  avatarUrl?: string;
  avatarType: 'photo' | 'emoji' | 'none';
  qrToken: string;
  isVerified: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  boothDate?: string;
  boothId?: string;
  weekStartDate?: string;
  registeredAt: string;
  // Activity details (populated from API)
  activityName?: string;
  boothName?: string;
  activityTime?: string;
  activityDescription?: string;
  backgroundColor?: string;
}

export default function ParticipantLandingPage() {
  const params = useParams();
  const token = params.token as string;
  const locale = (params.locale as string) || 'he';
  const isRTL = locale === 'he';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<RegistrationData | null>(null);

  useEffect(() => {
    async function fetchRegistration() {
      if (!token) {
        setError(isRTL ? 'טוקן חסר' : 'Missing token');
        setLoading(false);
        return;
      }

      try {
        // We need to find the registration by token
        // First try to get it from the API
        const response = await fetch(`/api/weeklycal/participant?token=${token}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError(isRTL ? 'הרשמה לא נמצאה' : 'Registration not found');
          } else {
            setError(isRTL ? 'שגיאה בטעינת הנתונים' : 'Error loading data');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setRegistration(data.registration);
      } catch (err) {
        console.error('Error fetching registration:', err);
        setError(isRTL ? 'שגיאה בטעינת הנתונים' : 'Error loading data');
      } finally {
        setLoading(false);
      }
    }

    fetchRegistration();
  }, [token, isRTL]);

  // Save QR code to device
  const handleSaveQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    // Convert SVG to canvas then to image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx?.scale(2, 2);
      ctx?.drawImage(img, 0, 0);

      // Download as PNG
      const link = document.createElement('a');
      link.download = `entry-code-${token}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
          <p className="mt-4 text-gray-600">{isRTL ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-sm">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isRTL ? 'שגיאה' : 'Error'}
          </h1>
          <p className="text-gray-600">{error || (isRTL ? 'הרשמה לא נמצאה' : 'Registration not found')}</p>
        </div>
      </div>
    );
  }

  const bgColor = registration.backgroundColor || '#3B82F6';

  return (
    <div
      className="min-h-screen flex flex-col"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: `${bgColor}10` }}
    >
      {/* Header */}
      <div
        className="p-6 text-white text-center"
        style={{ backgroundColor: bgColor }}
      >
        {/* Avatar */}
        {registration.avatarType === 'emoji' && registration.avatarUrl && (
          <div className="text-6xl mb-3">{registration.avatarUrl}</div>
        )}
        {registration.avatarType === 'photo' && registration.avatarUrl && (
          <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden border-4 border-white/30">
            <img
              src={registration.avatarUrl}
              alt={registration.nickname}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Name */}
        <h1 className="text-2xl font-bold">{registration.nickname}</h1>

        {/* Check-in status */}
        {registration.checkedIn ? (
          <div className="mt-2 inline-flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-full">
            <CheckCircle2 className="w-5 h-5" />
            <span>{isRTL ? 'נכנסתם!' : 'Checked in!'}</span>
          </div>
        ) : registration.isVerified ? (
          <div className="mt-2 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
            <CheckCircle2 className="w-5 h-5" />
            <span>{isRTL ? 'מאומת' : 'Verified'}</span>
          </div>
        ) : null}
      </div>

      {/* QR Code */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full">
          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-2xl shadow-inner">
              <QRCodeSVG
                id="qr-code-svg"
                value={registration.qrToken}
                size={200}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          </div>

          {/* Activity Details */}
          <div className="space-y-3 text-center">
            {registration.activityName && (
              <h2 className="text-xl font-bold text-gray-900">
                {registration.activityName}
              </h2>
            )}

            {registration.boothDate && (
              <div className="flex items-center justify-center gap-2 text-gray-700 font-medium">
                <Calendar className="w-5 h-5" />
                <span>
                  {new Date(registration.boothDate).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}

            {registration.activityTime && (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Clock className="w-5 h-5" />
                <span>{registration.activityTime}</span>
              </div>
            )}

            {registration.boothName && (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5" />
                <span>{registration.boothName}</span>
              </div>
            )}

            {registration.count > 1 && (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span>
                  {isRTL ? `${registration.count} אנשים` : `${registration.count} people`}
                </span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-sm text-gray-600">
              {isRTL
                ? 'הציגו את הקוד הזה בכניסה לפעילות'
                : 'Show this code at the activity entrance'}
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveQR}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ backgroundColor: bgColor }}
          >
            <Download className="w-5 h-5" />
            {isRTL ? 'שמור לתמונות' : 'Save to photos'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-sm text-gray-500">
        <p>{isRTL ? 'קוד כניסה' : 'Entry Code'}: {registration.qrToken}</p>
      </div>
    </div>
  );
}
