interface Props {
  message: string
}

export function LoadingState({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
      <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-300 text-sm">{message}</p>
    </div>
  )
}
