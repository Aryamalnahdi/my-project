import Link from "next/link";
export default function NotFound() {
  return <main className="error-page"><h1>Ticket unavailable</h1><p>This page does not exist or is not available to your account.</p><Link className="button primary" href="/">Return to dashboard</Link></main>;
}
