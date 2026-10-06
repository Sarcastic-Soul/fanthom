import Link from "next/link";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr";

export function UploadButton() {
  return (
    <Link href="/calendar#upload" className="btn">
      <UploadSimple size={15} />
      Add a recording
    </Link>
  );
}
