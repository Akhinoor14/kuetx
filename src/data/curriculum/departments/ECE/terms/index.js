const c = (code, title, credits, contactHours, type = 'Theory', isOptional = false) => ({
  code,
  title,
  credits,
  contactHours,
  type,
  isOptional,
});

export const Y1T1 = [
  c('ECE 1109', 'Introduction to Electronics and Communication Engineering', 3, '3'),
  c('ECE 1110', 'Introduction to Electronics and Communication Engineering Laboratory', 1.5, '3', 'Sessional'),
  c('EEE 1109', 'Basic Electrical Engineering', 3, '3'),
  c('EEE 1110', 'Basic Electrical Engineering Laboratory', 1.5, '3', 'Sessional'),
  c('Ph 1109', 'Physics', 3, '3'),
  c('Ph 1110', 'Physics Laboratory', 1.5, '3', 'Sessional'),
  c('Math 1109', 'Differential and Integral Calculus', 3, '3'),
  c('Hum 1109', 'Technical English', 3, '3'),
];

export const Y1T2 = [
  c('ECE 1205', 'Science of Engineering Materials', 3, '3'),
  c('ECE 1209', 'Analog Electronics-I', 3, '3'),
  c('ECE 1210', 'Analog Electronics-I Laboratory', 1.5, '3', 'Sessional'),
  c('CSE 1209', 'Computer Fundamentals and Programming', 3, '3'),
  c('CSE 1210', 'Computer Fundamentals and Programming Laboratory', 1.5, '3', 'Sessional'),
  c('Ch 1209', 'Chemistry', 3, '3'),
  c('Ch 1210', 'Chemistry Laboratory', 0.75, '3/2', 'Sessional'),
  c('Math 1209', 'Coordinate Geometry and Differential Equations', 3, '3'),
  c('Hum 1210', 'Technical English Laboratory', 0.75, '3/2', 'Sessional'),
];

export const Y2T1 = [
  c('CSE 2100', 'Object Oriented Programming Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 2101', 'Analog Electronics-II', 3, '3'),
  c('ECE 2102', 'Analog Electronics-II Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 2103', 'Digital Electronics and Logic Circuits', 3, '3'),
  c('ECE 2104', 'Digital Electronics and Logic Circuits Laboratory', 1.5, '3', 'Sessional'),
  c('ECE 2105', 'Electromagnetic Fields and Waves', 3, '3'),
  c('ECE 2107', 'Signals and Systems', 3, '3'),
  c('ECE 2108', 'Signal and Systems Laboratory', 0.75, '3/2', 'Sessional'),
  c('ME 2110', 'Engineering Drawing', 0.75, '3/2', 'Sessional'),
  c('Math 2109', 'Vector, Matrix and Transform', 3, '3'),
];

export const Y2T2 = [
  c('ECE 2200', 'Electronic Circuits Design Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 2201', 'Analog Communications', 3, '3'),
  c('ECE 2202', 'Analog Communications Laboratory', 1.5, '3', 'Sessional'),
  c('ECE 2207', 'Microprocessors and Microcomputers', 3, '3'),
  c('ECE 2208', 'Microprocessors and Microcomputers Laboratory', 0.75, '3/2', 'Sessional'),
  c('EEE 2209', 'Electrical Drives and Instrumentation', 3, '3'),
  c('EEE 2210', 'Electrical Drives and Instrumentation Laboratory', 0.75, '3/2', 'Sessional'),
  c('CSE 2209', 'Data Structures and Algorithm', 3, '3'),
  c('CSE 2210', 'Data Structures and Algorithm Laboratory', 1.5, '3', 'Sessional'),
  c('Math 2209', 'Complex Variables, Statistics and Special Functions', 3, '3'),
];

export const Y3T1 = [
  c('CSE 3100', 'Web Programming Laboratory', 1.5, '3', 'Sessional'),
  c('ECE 3101', 'Industrial Electronics', 3, '3'),
  c('ECE 3102', 'Industrial Electronics Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 3103', 'Digital Communications', 3, '3'),
  c('ECE 3104', 'Digital Communications Laboratory', 1.5, '3', 'Sessional'),
  c('ECE 3105', 'Microwave Engineering and Radar', 3, '3'),
  c('ECE 3106', 'Microwave Engineering and Radar Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 3109', 'Numerical Analysis', 3, '3'),
  c('ECE 3110', 'Numerical Analysis Laboratory', 0.75, '3/2', 'Sessional'),
  c('Hum 3109', 'Economics and Accounting', 3, '3'),
];

export const Y3T2 = [
  c('ECE 3200', 'Electronics Project Design/Development', 1.5, '3', 'Project'),
  c('ECE 3201', 'Information Theory', 3, '3'),
  c('ECE 3203', 'Digital Signal Processing', 3, '3'),
  c('ECE 3204', 'Digital Signal Processing Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 3205', 'Optical Fiber Communications', 3, '3'),
  c('ECE 3206', 'Optical Fiber Communications Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 3207', 'Antenna Engineering', 3, '3'),
  c('ECE 3208', 'Antenna Engineering Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 3210', 'Modeling and Simulation Laboratory', 0.75, '3/2', 'Sessional'),
  c('CSE 32**', 'Optional I', 3, '3', 'Theory', true),
  c('CSE 32**L', 'Optional I Laboratory', 0.75, '3/2', 'Sessional', true),
];

export const Y4T1 = [
  c('ECE 4000', 'Capstone Project/Thesis', 1.5, '3', 'Project'),
  c('ECE 4101', 'VLSI Design and Technology', 3, '3'),
  c('ECE 4102', 'VLSI Design and Technology Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 4103', 'Wireless and Cellular Communications', 3, '3'),
  c('ECE 4104', 'Wireless and Cellular Communications Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 4105', 'Engineers and Society', 3, '3'),
  c('ECE 4107', 'Machine Learning', 3, '3'),
  c('ECE 4108', 'Machine Learning Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 4150', 'Technical Writing and Presentation', 0.75, '3/2', 'Sessional'),
  c('ECE 41**', 'Optional II', 3, '3', 'Theory', true),
  c('ECE 41**L', 'Optional II Laboratory', 0.75, '3/2', 'Sessional', true),
  c('ECE 4100', 'Industrial Attachment', 0, '-', 'NonCredit'),
];

export const Y4T2 = [
  c('ECE 4000', 'Capstone Project/Thesis', 3, '6', 'Project'),
  c('ECE 4203', 'Satellite and Telecommunication Engineering', 3, '3'),
  c('ECE 4204', 'Satellite and Telecommunication Engineering Laboratory', 0.75, '3/2', 'Sessional'),
  c('ECE 4205', 'Computer Networks', 3, '3'),
  c('ECE 4206', 'Computer Networks Laboratory', 1.5, '3', 'Sessional'),
  c('Hum 4209', 'Project Management and Entrepreneurship', 3, '3'),
  c('ECE 42**', 'Optional III (Only Theory Course)', 3, '3', 'Theory', true),
  c('ECE 42**A', 'Optional IV', 3, '3', 'Theory', true),
  c('ECE 41**L2', 'Optional IV Laboratory', 0.75, '3/2', 'Sessional', true),
];

export const ECE_TERMS = {
  Y1T1,
  Y1T2,
  Y2T1,
  Y2T2,
  Y3T1,
  Y3T2,
  Y4T1,
  Y4T2,
};

export default ECE_TERMS;
