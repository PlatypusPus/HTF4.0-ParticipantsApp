const SIZES = { sm: 'w-5 h-5 border-[3px]', md: 'w-10 h-10 border-4', lg: 'w-16 h-16 border-4' }

export default function LoadingSpinner({ size = 'md' }) {
  return (
    <div className="flex items-center justify-center">
      <div className={`${SIZES[size]} border-black border-t-primary-container rounded-full animate-spin`} />
    </div>
  )
}
