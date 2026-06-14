'use client'
import { useEffect } from 'react'
import { printAuraSignature } from '@/lib/aura-boot'

/** Inheritance hook #2 — prints the Aura console signature once at boot. */
export function AuraSignature() {
  useEffect(() => {
    printAuraSignature()
  }, [])
  return null
}
