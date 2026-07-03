import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
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
  type Membership,
} from "@/lib/auth";

const roleLabel = (membership: Membership) =>
  membership.roles
    .map((role) => (role === "teacher" ? "Преподаватель" : "Студент"))
    .join(", ");

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
      toast.error("Введите код приглашения");
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

      toast.success(`Вы присоединились к курсу «${joined.course_title}»`);
      navigate(getCourseHomePath(joined.course_id), { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось присоединиться к курсу"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      width="narrow"
      title="Присоединиться к курсу"
      subtitle="Введите код приглашения, который вам дал преподаватель"
    >
      <Card className="p-6">
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Код приглашения</Label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="CHEM-STUD-V1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="identityValue">Идентификация (если требует курс)</Label>
            <Input
              id="identityValue"
              value={identityValue}
              onChange={(event) => setIdentityValue(event.target.value)}
              placeholder="Номер ИСУ или почта"
            />
          </div>
          <Button type="submit" variant="accent" disabled={loading}>
            {loading ? "Присоединяемся..." : "Присоединиться"}
          </Button>
        </form>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold">Ваши курсы</h2>
        {activeMemberships.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <GraduationCap className="h-5 w-5" />
            Вы пока не состоите ни в одном курсе.
          </div>
        ) : (
          <div className="space-y-2">
            {activeMemberships.map((membership) => (
              <div
                key={membership.course_id}
                className="flex items-center justify-between rounded-md border px-3 py-2.5"
              >
                <div>
                  <p className="font-medium">{membership.course_title}</p>
                  <p className="text-sm text-muted-foreground">{roleLabel(membership)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
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
    </PageShell>
  );
};

export default JoinCourse;
