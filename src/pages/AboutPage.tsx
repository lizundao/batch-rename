import { openUrl } from "@tauri-apps/plugin-opener";
import { InkdotBrandLogo } from "../components/InkdotBrandLogo";
import { useI18n } from "../context/I18nContext";
import {
  APP_VERSION,
  AUTHOR,
  BRAND_NAME,
  BRAND_SLUG,
  BRAND_URL,
} from "../constants/app";

interface AboutPageProps {
  onOpenLicense: () => void;
}

export function AboutPage({ onOpenLicense }: AboutPageProps) {
  const { tr } = useI18n();

  const openLink = (url: string) => {
    void openUrl(url);
  };

  return (
    <div className="page about-page">
      <header className="page-header">
        <h1>{tr("navAbout")}</h1>
        <p>{tr("aboutSubtitle")}</p>
      </header>

      <div className="free-banner">
        <span className="free-icon">✓</span>
        <div>
          <strong>{tr("freeBannerTitle")}</strong>
          <p>{tr("freeBannerBody", BRAND_SLUG)}</p>
        </div>
      </div>

      <div className="about-card">
        <h2>{tr("aboutCardTitle")}</h2>

        <div className="about-brand">
          <div className="about-brand-title">
            <span className="brand-logo-bg">
              <InkdotBrandLogo size={36} className="about-title-logo" />
            </span>
            <span>{BRAND_NAME}</span>
            <span className="about-brand-slug">{BRAND_SLUG}</span>
          </div>
          <div className="about-brand-tagline">
            {tr("brandTagline")} · inkdot.cn
          </div>
        </div>

        <dl className="about-meta">
          <div>
            <dt>{tr("metaAppName")}</dt>
            <dd>
              {tr("appName")}
              <span className="tag-free">{tr("tagFree")}</span>
            </dd>
          </div>
          <div>
            <dt>{tr("metaVersion")}</dt>
            <dd>{APP_VERSION}</dd>
          </div>
          <div>
            <dt>{tr("metaBrand")}</dt>
            <dd>
              {BRAND_NAME} ({BRAND_SLUG})
            </dd>
          </div>
          <div>
            <dt>{tr("metaAuthor")}</dt>
            <dd>{AUTHOR}</dd>
          </div>
          <div>
            <dt>{tr("metaWebsite")}</dt>
            <dd>
              <button
                type="button"
                className="link-btn"
                onClick={() => openLink(BRAND_URL)}
              >
                {tr("websiteLink")}
              </button>
            </dd>
          </div>
          <div>
            <dt>{tr("metaLicense")}</dt>
            <dd>
              {tr("licenseMetaBefore")}
              <button type="button" className="link-btn" onClick={onOpenLicense}>
                {tr("navLicense")}
              </button>
              {tr("licenseMetaAfter")}
            </dd>
          </div>
          <div>
            <dt>{tr("metaPosition")}</dt>
            <dd>{tr("appDescription")}</dd>
          </div>
        </dl>
      </div>

      <div className="principles-card">
        <h2>{tr("principlesTitle")}</h2>
        <ul>
          <li>{tr("principleFree")}</li>
          <li>{tr("principleOffline")}</li>
          <li>{tr("principleSecure")}</li>
          <li>{tr("principleConvenient")}</li>
          <li>{tr("principleGreen")}</li>
        </ul>
        <p className="hint">
          {tr("donateBefore")}{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => openLink(BRAND_URL)}
          >
            inkdot.cn
          </button>{" "}
          {tr("donateAfter")}
        </p>
      </div>
    </div>
  );
}
