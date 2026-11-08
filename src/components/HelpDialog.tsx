import { useState } from "react";
import { APP_VERSION } from "@/lib/help";

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"how" | "about">("how");
  return (
    <div className="mer-help" role="dialog" aria-modal="true" aria-label={tab === "how" ? "How to use" : "About"}>
      <div className="mer-help-box">
        <div className="mer-help-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "how"} onClick={() => setTab("how")}>
            How to
          </button>
          <button type="button" role="tab" aria-selected={tab === "about"} onClick={() => setTab("about")}>
            About
          </button>
          <button type="button" className="mer-help-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="mer-help-body">
          {tab === "how" ? (
            <>
              <h2>Pin a place</h2>
              <ul>
                <li>Type a city or postal code and tap <b>Find</b>. A pin drops on Earth and the sun and moon times show.</li>
                <li>Pick a date and time, or tap <b>Now</b> to come back to the present.</li>
              </ul>
              <h2>Look around</h2>
              <ul>
                <li>Drag the globe to turn it. Pinch or use the + and − buttons to zoom.</li>
                <li><b>First Person</b> puts you on the pin looking at the real sky for that time. Drag to look around. <b>Earth</b> takes you back.</li>
                <li>Tap a star, planet or constellation to see its name and a short note.</li>
                <li><b>Constellations</b> and <b>Planets</b> turn the lines, labels and tap-to-name on and off.</li>
                <li><b>Scientific</b> hides the menus for a clean view. Tap <b>Menu</b> to bring them back.</li>
              </ul>
              <h2>Music</h2>
              <ul>
                <li>The speaker button pauses and plays. The arrow skips to the next piece.</li>
                <li>The third button switches between music that follows the time of day at your pin, and shuffle.</li>
              </ul>
              <h2>Keeps your place</h2>
              <ul>
                <li>If the app reloads or your phone closes it, your pin, date, view and settings come back for 4 hours.</li>
                <li>Swiping down no longer reloads the app.</li>
              </ul>
              <h2>Weak or no signal</h2>
              <ul>
                <li>Open Meridian once with a signal. After that it opens with no signal and the globe still works.</li>
                <li>Place search and music need a signal. If the app ever stops with an error, tap <b>Restart</b>.</li>
              </ul>
            </>
          ) : (
            <>
              <h2>Sour Paint Studios Meridian 4.0</h2>
              <p>{APP_VERSION}</p>
              <p>Pin a place on Earth and watch the Sun, Moon, planets and stars for any date and time.</p>
              <p>Music follows the sun. Credits are under the info button in the top corner.</p>
              <p>Made by Daniel Lee Ruggeberg. Chandler, Arizona. Questions: sourpaintstudios@gmail.com</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
