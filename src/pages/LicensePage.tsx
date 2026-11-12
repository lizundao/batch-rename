import { BRAND_NAME, BRAND_SLUG } from "../constants/app";
import { useI18n } from "../context/I18nContext";

export function LicensePage() {
  const { tr } = useI18n();
  const year = new Date().getFullYear();

  return (
    <div className="page license-page">
      <header className="page-header">
        <h1>{tr("navLicense")}</h1>
        <p>{tr("licenseSubtitle")}</p>
      </header>

      <div className="license-card">
        <h2>{tr("licenseHeading")}</h2>
        <p>{tr("licenseCopyright", year, BRAND_NAME, BRAND_SLUG)}</p>

        <p>{tr("licensePara1")}</p>
        <p>{tr("licensePara2")}</p>
        <p>{tr("licensePara3")}</p>

        <p className="hint">{tr("licenseFooter", tr("appName"), BRAND_SLUG)}</p>
      </div>
    </div>
  );
}
