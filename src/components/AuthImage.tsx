import { useEffect, useState } from "react";

import { fetchImageAsBlobUrl } from "@/lib/api";

type AuthImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Optional: called when image fails to load */
  onError?: () => void;
};

/**
 * Renders an image from an API URL by fetching it with the current auth token.
 * Use this for task-bank and trainer images, since <img src="..."> does not send Authorization.
 */
export function AuthImage({ src, alt, className, onError }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) return;
    setFailed(false);
    let revoked = false;
    fetchImageAsBlobUrl(src)
      .then((url) => {
        if (!revoked) setObjectUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (!revoked) {
          setFailed(true);
          onError?.();
        }
      });
    return () => {
      revoked = true;
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [src, onError]);

  if (failed) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-muted/60 p-2 text-center`}
        style={{ minHeight: 80, minWidth: 80 }}
        title="Не удалось загрузить изображение"
        role="img"
        aria-label={`${alt}. Не удалось загрузить изображение`}
      >
        <span className="text-muted-foreground text-xs">Ошибка загрузки</span>
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div
        className={`${className ?? ""} animate-pulse bg-muted/60`}
        style={{ minHeight: 80, minWidth: 80 }}
        aria-busy="true"
        aria-label={`Загружается: ${alt}`}
      />
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}

export default AuthImage;
