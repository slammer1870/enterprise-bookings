'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ClientRichText from '@/components/RichText/Client'
import type { EmergencyContactPerson, EmergencyContactPersonType } from '@/lib/emergency-contacts/types'
import type { EmergencyContactSessionUser } from '@/lib/emergency-contacts/resolve-session-user'

type IntroData = Parameters<typeof ClientRichText>[0]['data']

function emptyContact() {
  return { name: '', phone: '', relationship: '' }
}

function emptyPerson(overrides?: Partial<EmergencyContactPerson>): EmergencyContactPerson {
  return {
    fullName: '',
    personType: 'self',
    contacts: [emptyContact()],
    medicalNotes: '',
    ...overrides,
  }
}

export type EmergencyContactFormClientProps = {
  heading?: string | null
  intro?: IntroData | null
  sessionUser?: EmergencyContactSessionUser | null
  initialPeople?: EmergencyContactPerson[] | null
}

export function EmergencyContactFormClient({
  heading,
  intro,
  sessionUser = null,
  initialPeople = null,
}: EmergencyContactFormClientProps) {
  const pathname = usePathname()
  const isAuthenticated = Boolean(sessionUser)

  const [email, setEmail] = useState(sessionUser?.email ?? '')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [verifiedUser, setVerifiedUser] = useState<EmergencyContactSessionUser | null>(
    sessionUser,
  )
  const [people, setPeople] = useState<EmergencyContactPerson[]>(
    initialPeople?.length ? initialPeople : [emptyPerson()],
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  const unlocked = isAuthenticated || Boolean(token && verifiedUser)

  const signInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(pathname || '/')}`

  const title = useMemo(
    () => (typeof heading === 'string' && heading.trim() ? heading.trim() : 'Emergency contacts'),
    [heading],
  )

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyError(null)
    setRequiresAuth(false)
    setSaveSuccess(false)
    setVerifyLoading(true)
    try {
      const res = await fetch('/api/emergency-contacts/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVerifyError(typeof data.error === 'string' ? data.error : 'Unable to verify email.')
        setRequiresAuth(data.requiresAuth === true)
        setToken(null)
        setVerifiedUser(null)
        return
      }

      setToken(typeof data.token === 'string' ? data.token : null)
      setVerifiedUser(data.user ?? null)
      setPeople([
        emptyPerson({
          fullName: typeof data.user?.name === 'string' ? data.user.name : '',
          personType: 'self',
        }),
      ])
    } catch {
      setVerifyError('Unable to verify email.')
      setToken(null)
      setVerifiedUser(null)
    } finally {
      setVerifyLoading(false)
    }
  }

  const updatePerson = (index: number, patch: Partial<EmergencyContactPerson>) => {
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const updateContact = (
    personIndex: number,
    contactIndex: number,
    patch: Partial<EmergencyContactPerson['contacts'][number]>,
  ) => {
    setPeople((prev) =>
      prev.map((p, i) => {
        if (i !== personIndex) return p
        return {
          ...p,
          contacts: p.contacts.map((c, ci) => (ci === contactIndex ? { ...c, ...patch } : c)),
        }
      }),
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated && !token) return
    setSaveError(null)
    setSaveSuccess(false)
    setSaveLoading(true)
    try {
      const res = await fetch('/api/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(token ? { token } : {}),
          people,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(typeof data.error === 'string' ? data.error : 'Unable to save.')
        return
      }
      setSaveSuccess(true)
    } catch {
      setSaveError('Unable to save emergency contacts.')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {intro ? <ClientRichText data={intro} enableGutter={false} /> : null}
      </div>

      {isAuthenticated ? (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Signed in as {sessionUser?.email}</p>
          {sessionUser?.name ? (
            <p className="text-sm text-muted-foreground">{sessionUser.name}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Your saved emergency contacts are shown below. Update them and save when you are done.
          </p>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="emergency-contact-email">Your account email</Label>
            <Input
              id="emergency-contact-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={verifyLoading}
            />
            <p className="text-sm text-muted-foreground">
              Enter the email on your booking account. If you have not submitted emergency contacts
              yet, you can continue after we confirm your email. If you already have contacts on
              file, you will need to sign in.
            </p>
          </div>
          {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
          {requiresAuth ? (
            <Button asChild>
              <Link href={signInHref}>Sign in to view your emergency contacts</Link>
            </Button>
          ) : null}
          {verifiedUser ? (
            <p className="text-sm text-muted-foreground">
              Verified: {verifiedUser.email}
              {verifiedUser.name ? ` (${verifiedUser.name})` : ''}
            </p>
          ) : null}
          <Button type="submit" disabled={verifyLoading}>
            {verifyLoading ? 'Checking…' : unlocked ? 'Re-check email' : 'Continue'}
          </Button>
        </form>
      )}

      {unlocked ? (
        <form onSubmit={handleSave} className="space-y-6">
          {people.map((person, personIndex) => (
            <fieldset key={personIndex} className="space-y-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">
                Who is this for? (person {personIndex + 1})
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`person-name-${personIndex}`}>Full name</Label>
                  <Input
                    id={`person-name-${personIndex}`}
                    required
                    value={person.fullName}
                    onChange={(e) => updatePerson(personIndex, { fullName: e.target.value })}
                    placeholder="Child or adult full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`person-type-${personIndex}`}>Person type</Label>
                  <select
                    id={`person-type-${personIndex}`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={person.personType}
                    onChange={(e) =>
                      updatePerson(personIndex, {
                        personType: e.target.value as EmergencyContactPersonType,
                      })
                    }
                  >
                    <option value="self">Self</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {person.contacts.map((contact, contactIndex) => (
                <div key={contactIndex} className="space-y-3 rounded-md bg-muted/40 p-3">
                  <p className="text-sm font-medium">Emergency contact {contactIndex + 1}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Contact name</Label>
                      <Input
                        required
                        value={contact.name}
                        onChange={(e) =>
                          updateContact(personIndex, contactIndex, { name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        required
                        type="tel"
                        value={contact.phone}
                        onChange={(e) =>
                          updateContact(personIndex, contactIndex, { phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Input
                        required
                        value={contact.relationship}
                        onChange={(e) =>
                          updateContact(personIndex, contactIndex, {
                            relationship: e.target.value,
                          })
                        }
                        placeholder="e.g. parent, spouse"
                      />
                    </div>
                  </div>
                  {person.contacts.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updatePerson(personIndex, {
                          contacts: person.contacts.filter((_, i) => i !== contactIndex),
                        })
                      }
                    >
                      Remove contact
                    </Button>
                  ) : null}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updatePerson(personIndex, {
                    contacts: [...person.contacts, emptyContact()],
                  })
                }
              >
                Add another emergency contact
              </Button>

              <div className="space-y-2">
                <Label htmlFor={`medical-${personIndex}`}>Medical / allergy notes</Label>
                <textarea
                  id={`medical-${personIndex}`}
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
                  value={person.medicalNotes ?? ''}
                  onChange={(e) => updatePerson(personIndex, { medicalNotes: e.target.value })}
                />
              </div>

              {people.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPeople((prev) => prev.filter((_, i) => i !== personIndex))}
                >
                  Remove this person
                </Button>
              ) : null}
            </fieldset>
          ))}

          {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
          {saveSuccess ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              Emergency contacts saved. Thank you.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPeople((prev) => [...prev, emptyPerson({ personType: 'child' })])}
            >
              Add another person
            </Button>

            <Button type="submit" disabled={saveLoading}>
              {saveLoading ? 'Saving…' : 'Save emergency contacts'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Contact detail fields stay locked until your email is verified.
        </p>
      )}
    </div>
  )
}
