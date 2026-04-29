import { useState } from "react"

interface Props {
  error?: string
  showSettings: boolean
  apiKey: string
  onApiKeyChange: (key: string) => void
  onSaveApiKey: () => void
  onScrape: () => void
}

export function EmptyState({ error, showSettings, apiKey, onApiKeyChange, onSaveApiKey, onScrape }: Props) {
  const [localKey, setLocalKey] = useState(apiKey)

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-5 px-6 text-center">
      <div className="text-4xl">🏆</div>
      <h1 className="text-white font-bold text-lg">Cool Comments</h1>
      <p className="text-gray-400 text-sm leading-relaxed">
        Open any Instagram reel, then click the button below to scrape and rank its comments.
      </p>

      {error && (
        <div className="w-full p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
          {error}
        </div>
      )}

      {(showSettings || error === "Please enter your Gemini API key in settings.") && (
        <div className="w-full flex flex-col gap-2">
          <p className="text-gray-400 text-xs">Enter your <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">Gemini API key</a></p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIza..."
              value={localKey}
              onChange={(e) => {
                setLocalKey(e.target.value)
                onApiKeyChange(e.target.value)
              }}
              className="flex-1 bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500"
            />
            <button
              onClick={onSaveApiKey}
              className="px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onScrape}
        className="px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm"
      >
        🎯 Rank This Reel
      </button>
    </div>
  )
}
