import { AdminMatchingEditor } from "../../components/AdminMatchingEditor";
import { ChallengeListEditor } from "./ChallengeListEditor";
import { ChoiceFields } from "./ChoiceFields";
import { HangmanFields } from "./HangmanFields";
import { SortingFields } from "./SortingFields";
import { TrueFalseFields } from "./TrueFalseFields";
import type { AdminGameTypeEditorProps } from "./types";
import { WordAssemblyFields } from "./WordAssemblyFields";

export function QuizEditor(props: AdminGameTypeEditorProps) {
  return <ChallengeListEditor {...props} Fields={ChoiceFields} />;
}

export function MatchingEditor({ controller, game }: AdminGameTypeEditorProps) {
  if (!game.challenges[0]) return null;

  return (
    <AdminMatchingEditor
      game={game}
      disabled={controller.mutating !== null}
      mutating={controller.mutating}
      imageUploadsEnabled={game.allowsChallengeImageUploads}
      onAddDestination={() => void controller.addMatchingDestination()}
      onAddScenario={() => void controller.addChallenge()}
      onUpdate={controller.updateGame}
      onUploadImage={(challengeId, image) => void controller.uploadImage(challengeId, image)}
      onDeleteScenario={(challengeId) => void controller.deleteChallenge(challengeId)}
      onDeleteDestination={(sortOrder) => void controller.deleteMatchingDestination(sortOrder)}
    />
  );
}

export function TrueFalseEditor(props: AdminGameTypeEditorProps) {
  return <ChallengeListEditor {...props} Fields={TrueFalseFields} />;
}

export function PixelHuntEditor(props: AdminGameTypeEditorProps) {
  const uploadsDisabled = !props.game.allowsChallengeImageUploads;
  return (
    <ChallengeListEditor
      {...props}
      Fields={ChoiceFields}
      addDisabled={uploadsDisabled}
      addDisabledTitle={uploadsDisabled
        ? "Nya bildfrågor är avstängda i onlineversionens demoläge"
        : undefined}
      pixelatedPreview
    />
  );
}

export function SortingEditor(props: AdminGameTypeEditorProps) {
  return <ChallengeListEditor {...props} Fields={SortingFields} />;
}

export function WordAssemblyEditor(props: AdminGameTypeEditorProps) {
  return <ChallengeListEditor {...props} Fields={WordAssemblyFields} />;
}

export function HangmanEditor(props: AdminGameTypeEditorProps) {
  return <ChallengeListEditor {...props} Fields={HangmanFields} />;
}
