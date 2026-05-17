// MSE (Materials Science and Engineering) Course Structure - Term-wise

const MSE_COURSES = {
  Y1T1: {
    title: 'First Year First Term',
    courses: [
      { code: 'MSE 1101', title: 'Introduction to Materials Science and Engineering', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'EEE 1127', title: 'Electrical Engineering Fundamentals', credit: 4, theory: 4, tutorial: 0, practical: 0 },
      { code: 'EEE 1128', title: 'Electrical Engineering Fundamentals Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'Math 1127', title: 'Differential and Integral Calculus', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ph 1127', title: 'Optics and Waves', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ph 1128', title: 'Optics and Waves Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'Ch 1127', title: 'Inorganic and Physical Chemistry', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ch 1128', title: 'Inorganic and Physical Chemistry Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
    ]
  },
  Y1T2: {
    title: 'First Year Second Term',
    courses: [
      { code: 'ME 1220', title: 'Engineering Drawing Sessional-I', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'ME 1227', title: 'Engineering Mechanics', credit: 4, theory: 4, tutorial: 0, practical: 0 },
      { code: 'Math 1227', title: 'Differential Equations and Geometry', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ph 1227', title: 'Magnetism and Nuclear Physics', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ph 1228', title: 'Magnetism and Nuclear Physics Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'Ch 1227', title: 'Organic Chemistry', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ch 1228', title: 'Organic Chemistry Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'Hum 1227', title: 'Technical English', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Hum 1228', title: 'Technical English Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
    ]
  },
  Y2T1: {
    title: 'Second Year First Term',
    courses: [
      { code: 'MSE 2101', title: 'Crystallography', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 2102', title: 'Crystallography Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'MSE 2103', title: 'Thermodynamics of Materials', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 2108', title: 'Technical Writing and Presentation skill Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'ME 2110', title: 'Machine shop Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'ME 2120', title: 'Computer Aided Drawing', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'ME 2127', title: 'Solid Mechanics', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Math 2127', title: 'Vector Analysis and Linear Algebra', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Hum 2127', title: 'Accounting and Economics', credit: 3, theory: 3, tutorial: 0, practical: 0 },
    ]
  },
  Y2T2: {
    title: 'Second Year Second Term',
    courses: [
      { code: 'MSE 2201', title: 'Phase Diagrams and Transformations', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 2203', title: 'Mechanical Behavior of Materials', credit: 3, theory: 3, tutorial: 0, practical: 0, prerequisite: 'MSE 2101' },
      { code: 'MSE 2206', title: 'Compositional and Microstructural Analysis', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 2208', title: 'Materials Testing Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'CSE 2227', title: 'Programing Techniques', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'CSE 2228', title: 'Programing Techniques Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'Math 2227', title: 'Statistics, Fourier Series and Numerical Analysis', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Ph 2227', title: 'Basic Quantum Mechanics and Solid State Physics', credit: 3, theory: 3, tutorial: 0, practical: 0 },
    ]
  },
  Y3T1: {
    title: 'Third Year First Term',
    courses: [
      { code: 'MSE 3101', title: 'Transport Phenomena in Materials', credit: 3, theory: 3, tutorial: 0, practical: 0, prerequisite: 'Math 2227' },
      { code: 'MSE 3103', title: 'Materials Manufacturing Processes', credit: 4, theory: 4, tutorial: 0, practical: 0 },
      { code: 'MSE 3104', title: 'Materials Manufacturing Processes Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 3105', title: 'Welding and Materials Joining Processes', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 3106', title: 'Welding and Materials Joining Processes Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'MSE 3107', title: 'Physical Metallurgy of Materials', credit: 3, theory: 3, tutorial: 0, practical: 0, prerequisite: 'MSE 2201' },
      { code: 'MSE 3108', title: 'Physical Metallurgy of Materials Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'Hum 3127', title: 'Government and Sociology', credit: 3, theory: 3, tutorial: 0, practical: 0 },
    ]
  },
  Y3T2: {
    title: 'Third Year Second Term',
    courses: [
      { code: 'MSE 3201', title: 'Materials Characterization', credit: 3, theory: 3, tutorial: 0, practical: 0, prerequisite: 'MSE 2101' },
      { code: 'MSE 3202', title: 'Materials Characterization Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 3203', title: 'Ceramics and Glass Engineering', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 3204', title: 'Ceramics and Glass Engineering Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'MSE 3205', title: 'Corrosion and Surface Engineering', credit: 3, theory: 3, tutorial: 0, practical: 0, prerequisite: 'Ch 1127' },
      { code: 'MSE 3206', title: 'Corrosion and Surface Engineering Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 3208', title: 'Materials Processing Plant Design Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5, prerequisite: 'MSE 3103' },
      { code: 'MSE 32XX', title: 'Course from Elective-I', credit: 3, theory: 3, tutorial: 0, practical: 0, isElective: true },
      { code: 'IEM 3227', title: 'Industrial Management', credit: 3, theory: 3, tutorial: 0, practical: 0 },
    ]
  },
  Y4T1: {
    title: 'Fourth Year First Term',
    courses: [
      { code: 'MSE 4000', title: 'Thesis/Project', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 4101', title: 'Modern Iron and Steel Making', credit: 4, theory: 4, tutorial: 0, practical: 0 },
      { code: 'MSE 4103', title: 'Engineering Alloys and Materials Selection', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 4104', title: 'Engineering Alloys and Materials Selection Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'MSE 4105', title: 'Polymer and Composite Materials', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 4106', title: 'Polymer and Composite Materials Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 4107', title: 'Computational Materials Science', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 4108', title: 'Computational Materials Science Sessional', credit: 1.5, theory: 0, tutorial: 0, practical: 3 },
      { code: 'MSE 4109', title: 'Electronic, Magnetic and Optical Properties of Materials', credit: 3, theory: 3, tutorial: 0, practical: 0, prerequisite: 'Ph 1227' },
    ]
  },
  Y4T2: {
    title: 'Fourth Year Second Term',
    courses: [
      { code: 'MSE 4000', title: 'Thesis / Project', credit: 3, theory: 0, tutorial: 0, practical: 6 },
      { code: 'MSE 4201', title: 'Materials for Energy Conversion and Storage', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 4202', title: 'Materials for Energy Conversion and Storage Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'MSE 4211', title: 'Professional Ethics', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 4214', title: 'Failure Analysis Sessional', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'MSE 4216', title: 'Technical Seminar', credit: 0.75, theory: 0, tutorial: 0, practical: 1.5 },
      { code: 'EEE 4227', title: 'Semiconductor Materials and Devices', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'Hum 4227', title: 'Project Management and Entrepreneurship', credit: 3, theory: 3, tutorial: 0, practical: 0 },
      { code: 'MSE 42XX', title: 'Course from Elective-II', credit: 3, theory: 3, tutorial: 0, practical: 0, isElective: true },
    ]
  },
};

// Elective-I Courses (for Y3T2)
const MSE_ELECTIVE_I = [
  { code: 'MSE 3207', title: 'Materials Recycling and Environmental Aspects', credit: 3 },
  { code: 'MSE 3209', title: 'Extractive Metallurgy', credit: 3 },
];

// Elective-II Courses (for Y4T2)
const MSE_ELECTIVE_II = [
  { code: 'MSE 4231', title: 'Biomaterials', credit: 3 },
  { code: 'MSE 4233', title: 'Nano-structured Materials', credit: 3 },
  { code: 'MSE 4235', title: 'Materials in Extreme Environments', credit: 3 },
  { code: 'MSE 4237', title: 'Materials and Sustainable Development', credit: 3 },
];

module.exports = { MSE_COURSES, MSE_ELECTIVE_I, MSE_ELECTIVE_II };
