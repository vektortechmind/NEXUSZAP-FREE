import nexusDarkLogo from "../assets/branding/nexus.png";
import nexusLightLogo from "../assets/branding/nexus0.png";
import { useTheme } from "../contexts/useTheme";

type BrandLogoProps = {
  alt?: string;
  className?: string;
};

export function BrandLogo({ alt = "NexusZAP", className }: BrandLogoProps) {
  const { theme } = useTheme();
  const logoSrc = theme === "light" ? nexusLightLogo : nexusDarkLogo;

  return <img src={logoSrc} alt={alt} className={className} />;
}
