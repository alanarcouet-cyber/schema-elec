import { useState, useEffect } from 'react'
import useImage from 'use-image'
import { makeTransparent } from '../utils/transparentImage'

/** Pour les balises <img> — retourne une dataURL avec fond transparent. */
export function useTransparentSrc(url) {
  const [src, setSrc] = useState(url)
  useEffect(() => {
    if (!url) return
    setSrc(url)                          // affiche l'original pendant le traitement
    makeTransparent(url).then(setSrc)
  }, [url])
  return src
}

/** Pour Konva <Image> — retourne un HTMLImageElement avec fond transparent. */
export function useTransparentKonvaImage(url) {
  const [tUrl, setTUrl] = useState(null)
  useEffect(() => {
    if (!url) return
    makeTransparent(url).then(setTUrl)
  }, [url])
  const [img] = useImage(tUrl ?? '')
  return img
}
