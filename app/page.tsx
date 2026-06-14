import { ArrowUpRight, GithubLogo, FileText } from '@phosphor-icons/react/dist/ssr'
import { getPortfolio } from '@/lib/firestore'
import { Hero } from '@/components/site/hero'
import { Section } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { ContactForm } from '@/components/site/contact-form'
import { ThemeChip } from '@/components/aura/theme-chip'

// Render per-request so the container build never needs Firestore creds;
// Cloud Run's runtime service account reads Firestore at request time.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const p = await getPortfolio()

  return (
    <>
      <Hero portfolio={p} />

      {/* ABOUT */}
      <Section id="about" index="01" eyebrow="about" title="a physicist who ships." divider={false}>
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="measure space-y-6" style={{ color: 'var(--fg-muted)' }}>
              <p>
                i started in physics — a phd at {p.education.institution.split(',')[0]}, modelling
                neural networks and the dynamics of living systems. that work taught me to respect
                evidence over hype, and to build things that survive contact with the real world.
              </p>
              <p>
                today i lead generative and agentic AI at Discover: fine-tuning LLMs, designing
                multi-agent workflows, and standing up the MLOps that keeps them honest in
                production. i still teach and publish on the side, mostly computer vision for
                brain-organoid research at Ohio University.
              </p>
              <p>{p.about.description}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <dl className="space-y-5 text-sm">
              {[
                ['based', p.personal.location],
                ['doctorate', p.education.degree],
                ['institution', p.education.institution],
                ['focus', 'generative ai · agentic systems · mlops'],
              ].map(([k, v]) => (
                <div key={k} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)' }}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-1" style={{ color: 'var(--fg)' }}>{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      {/* EXPERIENCE */}
      <Section id="experience" index="02" eyebrow="experience" title="where the work happened.">
        <ol className="space-y-px">
          {p.experience.map((exp, i) => (
            <Reveal as="li" key={exp.company} delay={Math.min(i * 0.05, 0.15)}>
              <div
                className="grid gap-4 py-8 md:grid-cols-[1fr_2fr]"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div>
                  <h3 style={{ fontSize: 'var(--text-h3)', fontWeight: 400, color: 'var(--fg)' }}>{exp.title}</h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--accent)' }}>{exp.company}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{exp.period}</p>
                </div>
                <ul className="space-y-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
                  {exp.achievements.map((a, j) => (
                    <li key={j} className="flex gap-3">
                      <span aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }}>◐</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* WORK / PROJECTS */}
      <Section id="work" index="03" eyebrow="selected work" title="things i built outside the day job." intro="small, sharp tools — most of them agentic, most of them open source.">
        <div className="grid gap-5 md:grid-cols-3">
          {p.projects.map((proj, i) => {
            const href = proj.liveUrl || proj.codeUrl || proj.paperUrl
            const inner = (
              <>
                <span className="eyebrow">{proj.type}</span>
                <h3 style={{ fontSize: 'var(--text-h3)', fontWeight: 400, color: 'var(--fg)', lineHeight: 'var(--lh-h3)' }}>{proj.title}</h3>
                <p className="text-sm" style={{ color: 'var(--fg-muted)', flex: 1 }}>{proj.description}</p>
                <div className="flex flex-wrap gap-2">
                  {proj.technologies.map((t) => <ThemeChip key={t} label={t} />)}
                </div>
                {href && (
                  <span className="link-arrow" style={{ marginTop: 'var(--sp-2)' }}>
                    {proj.codeUrl ? <><GithubLogo size={14} /> view source</> : <>open <ArrowUpRight size={14} weight="bold" /></>}
                  </span>
                )}
              </>
            )
            return (
              <Reveal key={proj.title} delay={Math.min(i * 0.05, 0.15)}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="plate h-full">{inner}</a>
                ) : (
                  <div className="plate h-full">{inner}</div>
                )}
              </Reveal>
            )
          })}
        </div>
      </Section>

      {/* PUBLICATIONS */}
      <Section id="publications" index="04" eyebrow="research" title="peer-reviewed work." intro="from cellular reprogramming to graphene chemistry to brain-organoid maturation.">
        <ul className="space-y-px">
          {p.publications.map((pub, i) => (
            <Reveal as="li" key={pub.title} delay={Math.min(i * 0.04, 0.12)}>
              <div className="flex flex-col gap-2 py-6 md:flex-row md:items-start md:justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="md:max-w-3xl">
                  <h3 style={{ fontSize: 'var(--text-body)', color: 'var(--fg)' }}>{pub.title}</h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--fg-dim)' }}>{pub.authors} · {pub.journal}</p>
                </div>
                <span
                  className="shrink-0 self-start text-xs"
                  style={{
                    fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase',
                    color: pub.status === 'published' ? 'var(--accent)' : 'var(--fg-dim)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '4px 10px',
                  }}
                >
                  {pub.status === 'published' ? 'published' : 'in review'}
                </span>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal>
          <a className="link-arrow mt-10 inline-flex" href="https://scholar.google.com/citations?user=P2w4iY4AAAAJ&hl=en" target="_blank" rel="noreferrer">
            <FileText size={15} /> all publications on google scholar →
          </a>
        </Reveal>
      </Section>

      {/* SKILLS */}
      <Section id="skills" index="05" eyebrow="toolkit" title="what i reach for.">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(p.skills).map(([group, items]) => (
            <Reveal key={group}>
              <div>
                <h3 className="eyebrow" style={{ color: 'var(--fg)' }}>{group.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}</h3>
                <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                  {items.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CONTACT */}
      <Section id="contact" index="06" eyebrow="contact" title="let's talk about the work." intro="generative ai strategy, agentic workflows, production mlops, or research — reach out.">
        <div className="grid gap-12 md:grid-cols-2">
          <Reveal>
            <dl className="space-y-5 text-sm">
              {[
                ['email', p.personal.email, `mailto:${p.personal.email}`],
                ['linkedin', 'sai-teja-pusuluri', p.personal.LinkedInUrl],
                ['github', 'sai19872000', p.personal.GitHubUrl],
                ['based', p.personal.location, null],
              ].map(([k, v, href]) => (
                <div key={k as string} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)' }}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-1">
                    {href ? (
                      <a href={href as string} target={String(href).startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ color: 'var(--fg)', textDecoration: 'none' }}>{v}</a>
                    ) : (
                      <span style={{ color: 'var(--fg)' }}>{v}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </Section>
    </>
  )
}
