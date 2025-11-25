export interface EmotionalDetection {
  emotional_tone: 'stress' | 'insecurity' | 'excitement' | 'confusion' | 'fatigue' | 'indecision' | 'neutral';
  confidence: number; // 0-100
  soft_mode_required: boolean;
  signals: string[];
}

export function detectEmotionalSubtext(userMessage: string): EmotionalDetection {
  const msg = userMessage.toLowerCase().trim();
  
  // Emotional keyword patterns with weighted scoring
  const emotionalPatterns = {
    stress: {
      keywords: [
        /so stressed/i, /freaking out/i, /panicking/i, /overwhelmed/i,
        /can'?t handle/i, /too much/i, /pressure/i, /urgent/i,
        /need this asap/i, /running out of time/i, /last minute/i
      ],
      weight: 15,
    },
    insecurity: {
      keywords: [
        /not sure/i, /idk/i, /i don'?t know/i, /maybe/i, /think so/i,
        /looks bad/i, /look stupid/i, /look dumb/i, /embarrass/i,
        /will (?:they|people) think/i, /am i/i, /do i look/i,
        /insecure/i, /self-?conscious/i, /awkward/i
      ],
      weight: 12,
    },
    excitement: {
      keywords: [
        /so excited/i, /can'?t wait/i, /omg/i, /!!!/, /yay/i, /hype/i,
        /love this/i, /amazing/i, /perfect/i, /yasss/i, /finally/i,
        /😍|🔥|✨|💯|🎉/
      ],
      weight: 10,
    },
    confusion: {
      keywords: [
        /confused/i, /don'?t understand/i, /what do you mean/i,
        /huh/i, /wait what/i, /i'?m lost/i, /unclear/i,
        /not following/i, /makes no sense/i, /\?\?/
      ],
      weight: 12,
    },
    fatigue: {
      keywords: [
        /tired/i, /exhausted/i, /burned out/i, /can'?t even/i,
        /no energy/i, /drained/i, /done with/i, /over it/i,
        /ugh/i, /meh/i, /whatever/i, /don'?t care anymore/i
      ],
      weight: 13,
    },
    indecision: {
      keywords: [
        /can'?t decide/i, /torn between/i, /both/i, /either/i,
        /help me choose/i, /what should i/i, /which one/i,
        /stuck/i, /indecisive/i, /unsure/i
      ],
      weight: 10,
    },
  };

  const scores: Record<string, number> = {
    stress: 0,
    insecurity: 0,
    excitement: 0,
    confusion: 0,
    fatigue: 0,
    indecision: 0,
  };

  const signals: string[] = [];

  // Score each emotion
  for (const [emotion, { keywords, weight }] of Object.entries(emotionalPatterns)) {
    for (const pattern of keywords) {
      if (pattern.test(msg)) {
        scores[emotion] += weight;
        signals.push(`${emotion}: ${pattern.source.slice(0, 30)}`);
      }
    }
  }

  // Additional signals from message structure
  if (msg.length < 10 && /\?\?/.test(msg)) {
    scores.confusion += 10;
    signals.push('confusion: very short + multiple ?');
  }

  if (msg.split(/[.!?]/).length > 5) {
    scores.stress += 5;
    signals.push('stress: rapid-fire sentences');
  }

  if (/\.\.\./.test(msg)) {
    scores.insecurity += 5;
    signals.push('insecurity: trailing ellipsis');
  }

  // Determine dominant emotion
  const maxScore = Math.max(...Object.values(scores));
  const dominantEmotion = Object.keys(scores).find(e => scores[e] === maxScore) || 'neutral';

  // Confidence based on score strength
  const confidence = Math.min(maxScore * 2, 100);

  // Soft mode required for vulnerable emotions
  const vulnerableEmotions = ['stress', 'insecurity', 'fatigue', 'confusion'];
  const soft_mode_required = vulnerableEmotions.includes(dominantEmotion) && confidence > 40;

  return {
    emotional_tone: dominantEmotion as EmotionalDetection['emotional_tone'],
    confidence,
    soft_mode_required,
    signals: signals.slice(0, 3), // Top 3 signals
  };
}
