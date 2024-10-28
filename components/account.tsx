'use client'

import { Button } from "@/components/ui/button"
import { LogOut, ScanFace } from 'lucide-react'
import { signIn, signOut, useSession } from 'next-auth/react'

export function Account() {
  const { data: session } = useSession()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="bg-black/10 backdrop-blur-sm hover:bg-background/50 transition-colors rounded-lg"
      onClick={() => session ? signOut() : signIn('google')}
    >
      {session ? <LogOut className="h-4 w-4" /> : <ScanFace className="h-4 w-4" />}
    </Button>
  )
}
