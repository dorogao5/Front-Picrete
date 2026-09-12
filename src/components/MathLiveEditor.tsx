import MathEditor from './MathEditor';
export function MathLiveEditor({ value, onChange, placeholder, className }: {
  value: string; onChange: (value: string) => void; placeholder?: string; className?: string;
}) { return <MathEditor value={value} onChange={onChange} hint={placeholder} className={className} label="Распознанный текст" />; }
