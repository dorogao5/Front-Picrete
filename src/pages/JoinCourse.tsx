import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { coursesAPI, getApiErrorMessage } from "@/lib/api";
import {
  getCourseHomePath,
  getMemberships,
  setActiveCourseId,
  setMemberships,
} from "@/lib/auth";
import { toast } from "sonner";

const JoinCourse = () => {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState("");
  const [identityValue, setIdentityValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [memberships, setMembershipsState] = useState(getMemberships());

  const activeMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === "active"),
    [memberships]
  );

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error("Введите invite-код");
      return;
    }

    setLoading(true);
    try {
      const normalizedIdentity = identityValue.trim();
      let identityPayload: Record<string, string> = {};
      if (normalizedIdentity) {
        if (/^\d{6}$/.test(normalizedIdentity)) {
          identityPayload = { isu: normalizedIdentity };
        } else if (normalizedIdentity.includes("@")) {
          identityPayload = { email: normalizedIdentity };
        } else {
          identityPayload = { text: normalizedIdentity };
        }
      }

      const response = await coursesAPI.join({
        invite_code: inviteCode.trim(),
        identity_payload: identityPayload,
      });

      const joined = response.data.membership;
      const current = getMemberships();
      const merged = [...current.filter((membership) => membership.course_id !== joined.course_id), joined];
      setMemberships(merged);
      setMembershipsState(merged);
      setActiveCourseId(joined.course_id);

      toast.success(`Вы присоединились к курсу: ${joined.course_title}`);
      navigate(getCourseHomePath(joined.course_id), { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось присоединиться к курсу"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-12 space-y-6">
        <Card className="max-w-2xl p-6">
          <h1 className="text-3xl font-bold mb-2">Присоединиться к курсу</h1>
          <p className="text-muted-foreground mb-6">
            Введите invite-код, полученный от преподавателя, и данные идентификации при необходимости.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="CHEM-STUD-V1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identityValue">Identity value (необязательно)</Label>
              <Input
                id="identityValue"
                value={identityValue}
                onChange={(event) => setIdentityValue(event.target.value)}
                placeholder="654321 или student@itmo.ru"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Присоединение..." : "Присоединиться"}
            </Button>
          </form>
        </Card>

        <Card className="max-w-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Ваши активные курсы</h2>
          {activeMemberships.length === 0 ? (
            <p className="text-muted-foreground">Пока нет активных memberships.</p>
          ) : (
            <div className="space-y-3">
              {activeMemberships.map((membership) => (
                <div
                  key={membership.course_id}
                  className="flex items-center justify-between rounded border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{membership.course_title}</p>
                    <p className="text-sm text-muted-foreground">{membership.roles.join(", ")}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveCourseId(membership.course_id);
                      navigate(getCourseHomePath(membership.course_id), { replace: true });
                    }}
                  >
                    Открыть
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default JoinCourse;
