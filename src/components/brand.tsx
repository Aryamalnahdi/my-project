"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

export function Brand() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const logo = new Image();
    logo.onload = () => setLoaded(true);
    logo.src = "/logo.png";
    return () => { logo.onload = null; };
  }, []);
  return <div className="brand" aria-label="Company Tasks">
    {loaded ? <img className="company-logo" src="/logo.png" alt="Company logo" onError={() => setLoaded(false)} />
      : <><span className="brand-symbol" aria-hidden="true"><Check size={25} strokeWidth={2.5} /></span><span>Company<span className="brand-caption">TASK PLATFORM</span></span></>}
  </div>;
}
