export type Domain = "ANALYTICAL" | "FOCUS_PRESSURE" | "COMMUNICATION" | "INNOVATION_CHANGE";

export type Trait =
  | "STRUCTURE"
  | "DETAIL_FOCUS"
  | "TENACITY"
  | "STRESS_TOLERANCE"
  | "DECISIVENESS"
  | "ADAPTABILITY"
  | "APPROACHABILITY"
  | "ASSERTIVENESS"
  | "LISTENING"
  | "CREATIVITY"
  | "CHANGE_PREFERENCE"
  | "PRACTICALITY";

export interface PersonalityQuestion {
  id: string;
  text: string;
  domain: Domain;
  trait: Trait;
  reverse?: boolean;
}

export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  // ANALYTICAL DOMAIN - STRUCTURE (4 questions)
  { id: "q1", text: "I prefer working with clear guidelines and structured processes.", domain: "ANALYTICAL", trait: "STRUCTURE", reverse: false },
  { id: "q2", text: "I feel most comfortable when I have a step-by-step plan to follow.", domain: "ANALYTICAL", trait: "STRUCTURE", reverse: false },
  { id: "q3", text: "I enjoy working in environments with flexible, changing rules.", domain: "ANALYTICAL", trait: "STRUCTURE", reverse: true },
  { id: "q4", text: "I prefer organized systems over improvisation.", domain: "ANALYTICAL", trait: "STRUCTURE", reverse: false },
  
  // ANALYTICAL DOMAIN - DETAIL_FOCUS (4 questions)
  { id: "q5", text: "I pay close attention to small details in my work.", domain: "ANALYTICAL", trait: "DETAIL_FOCUS", reverse: false },
  { id: "q6", text: "I often notice errors or inconsistencies that others miss.", domain: "ANALYTICAL", trait: "DETAIL_FOCUS", reverse: false },
  { id: "q7", text: "I prefer focusing on the big picture rather than details.", domain: "ANALYTICAL", trait: "DETAIL_FOCUS", reverse: true },
  { id: "q8", text: "I enjoy reviewing and refining work for accuracy.", domain: "ANALYTICAL", trait: "DETAIL_FOCUS", reverse: false },
  
  // FOCUS_PRESSURE DOMAIN - TENACITY (4 questions)
  { id: "q9", text: "I persist even when facing difficult challenges.", domain: "FOCUS_PRESSURE", trait: "TENACITY", reverse: false },
  { id: "q10", text: "I give up easily when things get tough.", domain: "FOCUS_PRESSURE", trait: "TENACITY", reverse: true },
  { id: "q11", text: "I am determined to complete tasks I start.", domain: "FOCUS_PRESSURE", trait: "TENACITY", reverse: false },
  { id: "q12", text: "I stick with problems until I find a solution.", domain: "FOCUS_PRESSURE", trait: "TENACITY", reverse: false },
  
  // FOCUS_PRESSURE DOMAIN - STRESS_TOLERANCE (4 questions)
  { id: "q13", text: "I remain calm under pressure.", domain: "FOCUS_PRESSURE", trait: "STRESS_TOLERANCE", reverse: false },
  { id: "q14", text: "I feel overwhelmed when deadlines are tight.", domain: "FOCUS_PRESSURE", trait: "STRESS_TOLERANCE", reverse: true },
  { id: "q15", text: "I perform well in high-pressure situations.", domain: "FOCUS_PRESSURE", trait: "STRESS_TOLERANCE", reverse: false },
  { id: "q16", text: "Stress negatively impacts my work quality.", domain: "FOCUS_PRESSURE", trait: "STRESS_TOLERANCE", reverse: true },
  
  // FOCUS_PRESSURE DOMAIN - DECISIVENESS (4 questions)
  { id: "q17", text: "I make decisions quickly and confidently.", domain: "FOCUS_PRESSURE", trait: "DECISIVENESS", reverse: false },
  { id: "q18", text: "I often struggle to choose between options.", domain: "FOCUS_PRESSURE", trait: "DECISIVENESS", reverse: true },
  { id: "q19", text: "I prefer to gather more information before deciding.", domain: "FOCUS_PRESSURE", trait: "DECISIVENESS", reverse: true },
  { id: "q20", text: "I trust my instincts when making choices.", domain: "FOCUS_PRESSURE", trait: "DECISIVENESS", reverse: false },
  
  // COMMUNICATION DOMAIN - ADAPTABILITY (4 questions)
  { id: "q21", text: "I easily adjust to new situations and changes.", domain: "COMMUNICATION", trait: "ADAPTABILITY", reverse: false },
  { id: "q22", text: "I find it difficult to adapt to unexpected changes.", domain: "COMMUNICATION", trait: "ADAPTABILITY", reverse: true },
  { id: "q23", text: "I am flexible in my approach to work.", domain: "COMMUNICATION", trait: "ADAPTABILITY", reverse: false },
  { id: "q24", text: "I prefer routines and predictable patterns.", domain: "COMMUNICATION", trait: "ADAPTABILITY", reverse: true },
  
  // COMMUNICATION DOMAIN - APPROACHABILITY (4 questions)
  { id: "q25", text: "People find it easy to approach me with questions or concerns.", domain: "COMMUNICATION", trait: "APPROACHABILITY", reverse: false },
  { id: "q26", text: "I am open and welcoming in my interactions.", domain: "COMMUNICATION", trait: "APPROACHABILITY", reverse: false },
  { id: "q27", text: "I prefer to keep my distance from colleagues.", domain: "COMMUNICATION", trait: "APPROACHABILITY", reverse: true },
  { id: "q28", text: "I enjoy helping others and being accessible.", domain: "COMMUNICATION", trait: "APPROACHABILITY", reverse: false },
  
  // COMMUNICATION DOMAIN - ASSERTIVENESS (4 questions)
  { id: "q29", text: "I confidently express my opinions and ideas.", domain: "COMMUNICATION", trait: "ASSERTIVENESS", reverse: false },
  { id: "q30", text: "I hesitate to speak up in group settings.", domain: "COMMUNICATION", trait: "ASSERTIVENESS", reverse: true },
  { id: "q31", text: "I am comfortable taking the lead in discussions.", domain: "COMMUNICATION", trait: "ASSERTIVENESS", reverse: false },
  { id: "q32", text: "I prefer to let others make decisions.", domain: "COMMUNICATION", trait: "ASSERTIVENESS", reverse: true },
  
  // COMMUNICATION DOMAIN - LISTENING (4 questions)
  { id: "q33", text: "I actively listen to others before responding.", domain: "COMMUNICATION", trait: "LISTENING", reverse: false },
  { id: "q34", text: "I often interrupt others while they're speaking.", domain: "COMMUNICATION", trait: "LISTENING", reverse: true },
  { id: "q35", text: "I remember details from conversations well.", domain: "COMMUNICATION", trait: "LISTENING", reverse: false },
  { id: "q36", text: "I focus on understanding others' perspectives.", domain: "COMMUNICATION", trait: "LISTENING", reverse: false },
  
  // INNOVATION_CHANGE DOMAIN - CREATIVITY (4 questions)
  { id: "q37", text: "I enjoy brainstorming and generating new ideas.", domain: "INNOVATION_CHANGE", trait: "CREATIVITY", reverse: false },
  { id: "q38", text: "I prefer following established methods over creating new ones.", domain: "INNOVATION_CHANGE", trait: "CREATIVITY", reverse: true },
  { id: "q39", text: "I think outside the box when solving problems.", domain: "INNOVATION_CHANGE", trait: "CREATIVITY", reverse: false },
  { id: "q40", text: "I enjoy experimenting with different approaches.", domain: "INNOVATION_CHANGE", trait: "CREATIVITY", reverse: false },
  
  // INNOVATION_CHANGE DOMAIN - CHANGE_PREFERENCE (4 questions)
  { id: "q41", text: "I welcome change and new opportunities.", domain: "INNOVATION_CHANGE", trait: "CHANGE_PREFERENCE", reverse: false },
  { id: "q42", text: "I prefer stability and consistency over change.", domain: "INNOVATION_CHANGE", trait: "CHANGE_PREFERENCE", reverse: true },
  { id: "q43", text: "I get excited about trying new things.", domain: "INNOVATION_CHANGE", trait: "CHANGE_PREFERENCE", reverse: false },
  { id: "q44", text: "I resist changes to my routine.", domain: "INNOVATION_CHANGE", trait: "CHANGE_PREFERENCE", reverse: true },
  
  // INNOVATION_CHANGE DOMAIN - PRACTICALITY (4 questions)
  { id: "q45", text: "I focus on practical, achievable solutions.", domain: "INNOVATION_CHANGE", trait: "PRACTICALITY", reverse: false },
  { id: "q46", text: "I prefer theoretical concepts over practical applications.", domain: "INNOVATION_CHANGE", trait: "PRACTICALITY", reverse: true },
  { id: "q47", text: "I value solutions that work in the real world.", domain: "INNOVATION_CHANGE", trait: "PRACTICALITY", reverse: false },
  { id: "q48", text: "I prioritize getting things done over perfect solutions.", domain: "INNOVATION_CHANGE", trait: "PRACTICALITY", reverse: false },
];

