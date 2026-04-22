import { notFound } from 'next/navigation'
import { prisma } from '@/lib/crm/db'
import { PublicFormClient } from '@/components/crm/forms/public-form'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const form = await prisma.crm_website_form.findUnique({ where: { publicSlug: slug } })
  return { title: form?.name ?? 'Enquiry Form' }
}

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params
  const form = await prisma.crm_website_form.findUnique({
    where: { publicSlug: slug },
    include: { branch: { select: { name: true } } },
  })

  if (!form) notFound()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '24px 14px',
        background: '#f3f3f3',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <PublicFormClient formId={form.id} slug={slug} schema={form.schema} />
    </div>
  )
}
