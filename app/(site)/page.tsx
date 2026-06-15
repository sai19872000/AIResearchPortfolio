import { ArrowUpRight, Code, FileText, Check } from 'lucide-react'
import { getPortfolio } from '@/lib/firestore'
import { Hero } from '@/components/site/hero'
import { Section } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { ContactForm } from '@/components/site/contact-form'

export const dynamic = 'force-dynamic'

const ACCENTS = ['warm', 'cool', 'seam'] as const

export default async function HomePage() {
  const p = await getPortfolio()

  return (
    <>
      <Hero portfolio={p} />

      {/* ABOUT */}
      <Section id="about" index="01" eyebrow="About" title="A physicist who ships." divider={false}>
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="measure space-y-6" style={{ color: 'var(--text-muted)' }}>
              <p>
                I started in physics — a PhD at {p.education.institution.split(',')[0]}, modelling neural
                networks and the dynamics of living systems. That work set the habit I still keep:
                respect the evidence, and build things that survive contact with the real world.
              </p>
              <p>
                Today I build agentic enterprise applications at <strong>GE Aerospace</strong> as a
                Sr. Staff Data Scientist — designing multi-agent systems on Databricks and AWS with the
                Claude Agent SDK, and the MLOps that keeps them honest in production. I still teach and
                publish on the side, mostly computer vision for brain-organoid research at Ohio University.
              </p>
              <p>{p.about.description}</p>
            </div>
          </Reveal>
          <Reveal>
            <dl className="space-y-5" style={{ fontSize: 15 }}>
              {[
                ['Based', p.personal.location],
                ['Doctorate', p.education.degree],
                ['Institution', p.education.institution],
                ['Focus', 'Generative AI · agentic systems · MLOps'],
              ].map(([k, v]) => (
                <div key={k} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <dt className="t-label">{k}</dt>
                  <dd className="mt-1" style={{ color: 'var(--text)' }}>{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      {/* EXPERIENCE */}
      <Section id="experience" index="02" eyebrow="Experience" title="Where the work happened.">
        <ol className="space-y-px">
          {p.experience.map((exp, i) => (
            <Reveal as="li" key={exp.company}>
              <div className="grid gap-4 py-8 md:grid-cols-[1fr_2fr]" style={{ borderTop: '1px solid var(--line)' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{exp.title}</h3>
                  <p className="mt-1" style={{ color: i % 2 ? 'var(--cool)' : 'var(--warm)', fontSize: 15 }}>{exp.company}</p>
                  <p className="t-label mt-2" style={{ textTransform: 'none', letterSpacing: '.04em' }}>{exp.period}</p>
                </div>
                <ul className="space-y-3" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                  {exp.achievements.map((a, j) => (
                    <li key={j} className="flex gap-3">
                      <Check size={16} style={{ color: i % 2 ? 'var(--cool)' : 'var(--warm)', flexShrink: 0, marginTop: 4 }} />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* WORK */}
      <Section id="work" index="03" eyebrow="Selected work" title="Things I built outside the day job." intro="Small, sharp tools — most of them agentic, most of them open source.">
        <div className="grid gap-5 md:grid-cols-3">
          {p.projects.map((proj, i) => {
            const href = proj.liveUrl || proj.codeUrl || proj.paperUrl
            const accent = ACCENTS[i % ACCENTS.length]
            const inner = (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                <span className="t-label">{proj.type}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{proj.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 15, flex: 1 }}>{proj.description}</p>
                <div className="flex flex-wrap gap-2">
                  {proj.technologies.map((t) => <span key={t} className="au-chip">{t}</span>)}
                </div>
                {href && (
                  <span className="link-arrow" style={{ marginTop: 4 }}>
                    {proj.codeUrl ? <><Code size={14} /> View source</> : <>Open <ArrowUpRight size={14} /></>}
                  </span>
                )}
              </div>
            )
            return (
              <Reveal key={proj.title}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className={`au-card au-card--accent au-card--${accent} h-full`}>{inner}</a>
                ) : (
                  <div className={`au-card au-card--accent au-card--${accent} h-full`}>{inner}</div>
                )}
              </Reveal>
            )
          })}
        </div>
      </Section>

      {/* PUBLICATIONS */}
      <Section id="publications" index="04" eyebrow="Research" title="Peer-reviewed work." intro="From cellular reprogramming to graphene chemistry to brain-organoid maturation.">
        <ul className="space-y-px">
          {p.publications.map((pub) => (
            <Reveal as="li" key={pub.title}>
              <div className="flex flex-col gap-2 py-6 md:flex-row md:items-start md:justify-between" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="md:max-w-3xl">
                  <h3 style={{ color: 'var(--text)', fontSize: 17 }}>{pub.title}</h3>
                  <p className="mt-1" style={{ color: 'var(--text-faint)', fontSize: 14 }}>{pub.authors} · {pub.journal}</p>
                </div>
                {pub.status === 'published' ? (
                  <span className="au-status au-status--green shrink-0"><span className="au-status__dot" />Published</span>
                ) : (
                  <span className="au-status shrink-0"><span className="au-status__dot" />In review</span>
                )}
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal>
          <a className="link-arrow" style={{ marginTop: 40, display: 'inline-flex' }} href="https://scholar.google.com/citations?user=P2w4iY4AAAAJ&hl=en" target="_blank" rel="noreferrer">
            <FileText size={15} /> All publications on Google Scholar <ArrowUpRight size={14} />
          </a>
        </Reveal>
      </Section>

      {/* SKILLS */}
      <Section id="skills" index="05" eyebrow="Toolkit" title="What I reach for.">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(p.skills).map(([group, items]) => (
            <Reveal key={group}>
              <div>
                <h3 className="t-label" style={{ color: 'var(--text)' }}>{group.replace(/([A-Z])/g, ' $1').trim()}</h3>
                <ul className="mt-4 space-y-2" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                  {items.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CONTACT */}
      <Section id="contact" index="06" eyebrow="Contact" title="Let’s talk about the work." intro="Generative AI strategy, agentic workflows, production MLOps, or research — reach out.">
        <div className="grid gap-12 md:grid-cols-2">
          <Reveal>
            <dl className="space-y-5" style={{ fontSize: 15 }}>
              {[
                ['Email', p.personal.email, `mailto:${p.personal.email}`],
                ['LinkedIn', 'sai-teja-pusuluri', p.personal.LinkedInUrl],
                ['GitHub', 'sai19872000', p.personal.GitHubUrl],
                ['Based', p.personal.location, null],
              ].map(([k, v, href]) => (
                <div key={k as string} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <dt className="t-label">{k}</dt>
                  <dd className="mt-1">
                    {href ? (
                      <a href={href as string} target={String(href).startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ color: 'var(--text)' }}>{v}</a>
                    ) : (
                      <span style={{ color: 'var(--text)' }}>{v}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal>
            <ContactForm />
          </Reveal>
        </div>
      </Section>
    </>
  )
}
