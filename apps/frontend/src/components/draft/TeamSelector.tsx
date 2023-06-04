import { For } from "solid-js";
import { useDraft } from "../../contexts/DraftContext";
import { Team } from "../../lib/models/Team";

const TEAMS = ["ally", "opponent"] as const;

export function TeamSelector() {
    const { selection, select, allyTeam, opponentTeam } = useDraft();

    function selectTeam(team: Team) {
        const picks = team === "ally" ? allyTeam : opponentTeam;
        const index = picks.findIndex((pick) => !pick.championKey);

        select(team, index);
    }

    return (
        <span class="isolate inline-flex rounded-md shadow-sm">
            <For each={TEAMS}>
                {(team, i) => (
                    <button
                        type="button"
                        class="text-lg relative inline-flex items-center border text-neutral-300 border-neutral-700 bg-primary px-3 py-1 font-medium hover:bg-neutral-800 uppercase"
                        classList={{
                            "rounded-r-md": i() === TEAMS.length - 1,
                            "rounded-l-md": i() === 0,
                            "-ml-px": i() !== 0,
                            "text-white !bg-neutral-700":
                                selection.team === team ||
                                (!selection.team && team === "ally"),
                        }}
                        onClick={() => selectTeam(team)}
                    >
                        {team}
                    </button>
                )}
            </For>
        </span>
    );
}
