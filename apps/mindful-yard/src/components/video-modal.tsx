'use client'

import { useState } from 'react'
import { Play, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@repo/ui/components/ui/dialog'
import { Button } from '@repo/ui/components/ui/button'

interface VideoModalProps {
  imageSrc: string
  videoSrc: string
  imageAlt: string
}

export function VideoModal({ imageSrc, videoSrc, imageAlt }: VideoModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="relative">
      <img
        src={imageSrc || '/placeholder.svg'}
        alt={imageAlt}
        className="w-full h-auto aspect-video"
      />
      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center transition-opacity hover:bg-opacity-50 p-4">
        <Button
          variant="default"
          size="icon"
          className="w-16 h-16 rounded-full p-4"
          onClick={() => setIsModalOpen(true)}
        >
          <Play className="w-8 h-8 text-white" />
        </Button>
      </div>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTitle className="sr-only">Video</DialogTitle>
        <DialogContent className="p-0 w-auto">
          <DialogClose asChild>
            <Button variant="secondary" size="icon" className="absolute top-2 right-2 z-10">
              <X className="w-4 h-4" />
            </Button>
          </DialogClose>
          <video src={videoSrc} controls autoPlay className="max-w-[80vw] max-h-[80vh] mx-auto">
            Your browser does not support the video tag.
          </video>
        </DialogContent>
      </Dialog>
    </div>
  )
}
