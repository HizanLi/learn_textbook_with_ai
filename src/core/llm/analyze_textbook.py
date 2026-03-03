"""
Textbook Analysis Module - Analyzes textbook structure and content
Integrates chunker data and table of contents to generate comprehensive learning content
"""
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

from llm_client import LLMClient, ModelProvider, OpenAIClient, DeepseekClient, GeminiClient
from learning_content import LearningContentGenerator
from prompts import *

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PathLike = Union[str, Path]


class TextbookAnalyzer:
    """
    Analyzes textbook content by processing chunked data and table of contents
    Generates structured learning content and key insights
    """
    
    def __init__(self, llm_client: Optional[LLMClient] = None, chunker_path: Optional[PathLike] = None):
        """
        Initialize TextbookAnalyzer
        
        Args:
            llm_client: LLM client instance. If None, creates OpenAI client
        """
        if llm_client is None:
            llm_client = OpenAIClient()
        
        self.llm_client = llm_client
        self.content_generator = LearningContentGenerator(llm_client)
        self.chunker_path = chunker_path 
        
    # Step 1: Load chunked content from JSON file        
    def load_chunker_data(self, chunker_path: Optional[PathLike] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Load chunked content from JSON file
        
        Args:
            chunker_path: Path to the chunker JSON file
            
        Returns:
            List of chunks or None if failed
        """
        try:
            chunker_path = Path(chunker_path) if chunker_path else self.chunker_path
            if not chunker_path.exists():
                logger.error(f"Chunker file not found: {chunker_path}")
                return None
            
            with open(chunker_path, 'r', encoding='utf-8') as f:
                chunks = json.load(f)
            
            logger.info(f"Successfully loaded {len(chunks)} chunks from {chunker_path}")
            return chunks
        except Exception as e:
            logger.error(f"Failed to load chunker data: {str(e)}")
            return None

    # Step 1: Load ToC data from JSON file (if available)
    def load_toc_data(self, toc_path: Optional[PathLike] = None) -> Optional[Dict[str, Any]]:
        """
        Try to load textbook_toc.json from the given path or the same directory as chunker_path
        
        Args:
            toc_path: Explicit path to the TOC JSON file. If None, looks for textbook_toc.json near chunker_path
            
        Returns:
            Parsed ToC dictionary or None if not found
        """
        try:
            if toc_path:
                t_path = Path(toc_path)
            elif self.chunker_path:
                t_path = Path(self.chunker_path).parent / "textbook_toc.json"
            else:
                return None

            if t_path.exists():
                with open(t_path, 'r', encoding='utf-8') as f:
                    toc_json = json.load(f)
                logger.info(f"Successfully loaded ToC from {t_path}")
                return toc_json
            return None
        except Exception as e:
            logger.error(f"Failed to load ToC data: {str(e)}")
            return None
    
    # Step 2: 解析目录结构
    def parse_table_of_content(self, toc_string: str, save_to_disk: bool = True) -> Optional[Dict[str, Any]]:
        """
        Parse string-formatted table of content using LLM and optionally save to disk
        
        Args:
            toc_string: String-formatted table of content
            save_to_disk: Whether to save the result to the same directory as chunker_path
            
        Returns:
            Parsed JSON structure or None if failed
        """
        try:
            prompt = ASK_TABLE_CONTENT_PROMPT.replace(
                "[PASTE_YOUR_TOC_HERE]",
                toc_string
            )
            
            toc_json = self.llm_client.generate_json(
                prompt=prompt,
                system_prompt="You are a precise data extraction script. Extract table of contents and return ONLY valid JSON without any markdown formatting."
            )
            
            logger.info("Successfully parsed table of content")

            # Store the result to the same path as chunker_path if requested
            if save_to_disk and self.chunker_path and toc_json:
                try:
                    chunker_p = Path(self.chunker_path)
                    # Create filename based on chunker filename or specific suffix

                    toc_filename = "textbook_toc.json"
                        
                    toc_path = chunker_p.parent / toc_filename
                    
                    with open(toc_path, 'w', encoding='utf-8') as f:
                        json.dump(toc_json, f, ensure_ascii=False, indent=4)
                    
                    logger.info(f"Table of contents saved to: {toc_path}")
                except Exception as e:
                    logger.error(f"Failed to save table of contents to disk: {str(e)}")

            return toc_json
        except Exception as e:
            logger.error(f"Failed to parse table of content: {str(e)}")
            return None
    
    # Step 3: 从 chunks 中提取关键信息和主题
    def extract_key_topics(self, chunks: List[Dict[str, Any]], toc_json: Optional[Dict[str, Any]] = None) -> Dict[str, Dict[str, Any]]:
        """
        Extract key topics and detailed points from chunks that match the Table of Contents.
        
        Args:
            chunks: List of chunk dictionaries from chunker
            toc_json: Parsed table of contents dictionary
            
        Returns:
            Dictionary mapping section titles to their extracted analysis results
        """
        section_key_points = {}
        if not chunks or not toc_json:
            logger.warning("Missing chunks or ToC for key topic extraction")
            return {}

        # Pre-process ToC to get a flat set of valid section titles for fast lookup
        toc_titles = set()
        for chapter in toc_json.get("chapters", []):
            toc_titles.add(chapter.get("chapter_title"))
            for section in chapter.get("sections", []):
                toc_titles.add(section.get("section_title"))
                for sub in section.get("sub_sections", []):
                    toc_titles.add(sub.get("sub_section_title"))

        logger.info(f"Extracting key points for sections matched in ToC...")

        chunker_headers = {}
        count = 0

        for chunk in chunks:
            print(chunk)
            header = chunk.get('Header') 
            if header:
                chunker_headers[header] = count
            count += 1 



        # for chunk in chunks:
        #     header = chunk.get('Header')
        #     content = chunk.get('content')

        #     # Check if this chunk's header exists in our ToC
        #     if header and header in toc_titles:
        #         if header not in section_key_points:
        #             logger.info(f"Extracting key points for section: {header}")
                    
        #             # Use ANALYZE_SECTION_PROMPT from prompts.py
        #             prompt = ANALYZE_SECTION_PROMPT.replace(
        #                 "[PASTE_SECTION_HEADER_HERE]", 
        #                 header
        #             ).replace(
        #                 "[PASTE_SECTION_CONTENT_HERE]", 
        #                 content
        #             )
                    
        #             try:
        #                 analysis = self.llm_client.generate_json(
        #                     prompt=prompt,
        #                     system_prompt="You are an expert academic tutor. Extract critical learning points from textbook content."
        #                 )
        #                 section_key_points[header] = analysis
        #             except Exception as e:
        #                 logger.error(f"Failed to extract points for {header}: {str(e)}")
        
        # return section_key_points
    

    def generate_chapter_analysis(
        self, 
        chapter_title: str,
        chapter_content: str,
        difficulty_level: str = "intermediate"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive analysis for a chapter
        
        Args:
            chapter_title: Title of the chapter
            chapter_content: Content of the chapter
            difficulty_level: Difficulty level for explanations
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            analysis = {
                "chapter_title": chapter_title,
                "timestamp": datetime.now().isoformat(),
                "summary": "",
                "key_concepts": [],
                "learning_outcomes": []
            }
            
            # Generate summary
            summary_prompt = f"Provide a concise summary (2-3 sentences) of the following chapter content:\n\n{chapter_content[:1000]}"
            analysis["summary"] = self.llm_client.generate_text(
                summary_prompt,
                system_prompt="You are an expert summarizer. Provide clear, concise summaries."
            )
            
            # Extract key concepts
            concepts_prompt = f"Extract the top 5 key concepts from this chapter, return as JSON list:\n\n{chapter_content[:1000]}"
            concepts_response = self.llm_client.generate_text(
                concepts_prompt,
                system_prompt="Return ONLY a JSON array of strings."
            )
            
            try:
                analysis["key_concepts"] = json.loads(concepts_response)
            except:
                analysis["key_concepts"] = concepts_response.split('\n')[:5]
            
            logger.info(f"Generated analysis for chapter: {chapter_title}")
            return analysis
        except Exception as e:
            logger.error(f"Failed to generate chapter analysis: {str(e)}")
            return {}
    

    def analyze_textbook(
        self,
        username: str,
        chunker_path: PathLike,
        toc_string: str,
        output_dir: Optional[PathLike] = None
    ) -> Dict[str, Any]:
        """
        Main function to analyze textbook
        Integrates chunked data and table of contents for comprehensive analysis
        
        Args:
            username: Username for the analysis context
            chunker_path: Path to the chunker JSON file
            toc_string: String-formatted table of content
            output_dir: Optional directory to save analysis results
            
        Returns:
            Dictionary containing complete textbook analysis
        """
        try:
            logger.info(f"Starting textbook analysis for user: {username}")
            
            # Load chunker data
            chunks = self.load_chunker_data(chunker_path)
            if chunks is None:
                raise ValueError(f"Failed to load chunker data from {chunker_path}")
            
            # Parse table of content
            toc_json = self.parse_table_of_content(toc_string)
            if toc_json is None:
                logger.warning("Failed to parse table of content, continuing with chunk-based analysis")
                toc_json = {}
            
            # Extract key information using the matched ToC
            section_key_points = self.extract_key_topics(chunks, toc_json)
            
            # Build analysis result
            analysis_result = {
                "username": username,
                "timestamp": datetime.now().isoformat(),
                "chunker_path": str(chunker_path),
                "total_chunks": len(chunks),
                "table_of_contents": toc_json,
                "section_key_points": section_key_points,
                "chunks_summary": {
                    "total_count": len(chunks),
                    "sample_chunks": chunks[:3] if len(chunks) >= 3 else chunks
                },
                "metadata": {
                    "book_title": toc_json.get("book_title", "Unknown"),
                    "total_chapters": len(toc_json.get("chapters", [])),
                    "analysis_model": self.llm_client.model_name,
                }
            }
            
            # Save to output directory if provided
            if output_dir:
                output_path = Path(output_dir)
                output_path.mkdir(parents=True, exist_ok=True)
                
                output_file = output_path / f"{username}_textbook_analysis.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(analysis_result, f, ensure_ascii=False, indent=2)
                
                logger.info(f"Analysis saved to {output_file}")
                analysis_result["output_file"] = str(output_file)
            
            logger.info(f"Textbook analysis completed successfully for user: {username}")
            return analysis_result
            
        except Exception as e:
            logger.error(f"Textbook analysis failed: {str(e)}")
            return {
                "error": str(e),
                "username": username,
                "timestamp": datetime.now().isoformat()
            }




if __name__ == "__main__":
    # Example usage
    # chunk_path = r"data\hizan\output\pyhton_short-1772218124093\hybrid_auto\chunker_step_1.json"
    chunk_path = r"data\hizan\output\java_short\hybrid_auto\chunker_step_1.json"

    analyzer = TextbookAnalyzer(chunker_path=chunk_path)

    # # 1. Try to load existing ToC data
    # toc_json = analyzer.load_toc_data()
    # chunks = analyzer.load_chunker_data(chunk_path)
    
    # if chunks and toc_json:
    #     logger.info("Running section analysis...")
    #     # analyze_textbook method wraps everything
    #     result = analyzer.extract_key_topics(
    #         chunks=chunks,
    #         toc_json=toc_json
    #     )
    #     print(result)

    text_toc_string_java = """
    # C o n t e n t s i n D e ta il

    # Acknowl edgments

    xvii

    # Introduction

    xix

    Why Should I Learn to Code? . . xx   
    Why Should I Learn Java? . . . xx   
    What’s in This Book . xx   
    What Tools Do I Need? . xxi   
    Online Resources . . xxi   
    Start Now! . . xxii

    # 1

    # Getting Started 1

    Java on Windows, macOS, and Linux . . . .   
    Installing Java 8 and 9 for Developers . . . . . 2   
    Installing the Eclipse IDE for Java Developers . . . .   
    Setting Up Eclipse . . . .

    Installing the WindowBuilder Editor . . 6   
    Customizing Eclipse’s Look and Feel .

    Installing Android Studio for Mobile App Development . . . 8   
    Getting to Know Java with JShell 9

    Running JShell . . 9

    Working with Java Expressions in JShell 12   
    Declaring Java Variables in JShell . 13   
    Printing Output in Java . . 15   
    JShell Commands 16

    What You Learned . . 17

    #

    # Buil d a Hi -Lo Guessing Game App! 19

    Planning the Game Step-by-Step . . . . . 20   
    Creating a New Java Project . . . . . . 20   
    Creating the HiLo Class 21

    Generating a Random Number . . . 23   
    Getting User Input from the Keyboard . . 25   
    Making the Program Print Output . . 27

    Loops: Ask, Check, Repeat . . 28

    if Statements: Testing for the Right Conditions . . 30   
    Adding a Play Again Loop . . . . 33

    Testing the Game . . 36   
    What You Learned . 38

    Programming Challenges . . . . . . . 39

    #1: Expanding Your Range . . . 40   
    #2: Counting Tries . 40   
    #3: Playing MadLibs . 41

    # 3 Creating a GU I for Our Guessing Game 43

    Practicing with JShell . 44

    Creating a GUI in Four Lines of Code . . . 44   
    Creating an Interactive GUI in 10 Lines of Code! 45

    Setting Up the GUI App in Eclipse . . . . . 48   
    GUI Design with Eclipse’s WindowBuilder Editor . 50

    Designing the User Interface . . . . . 51

    Setting GUI Properties in the Properties Pane . . . 51   
    Customizing GUI Components in the Palette Pane . . . 52   
    Aligning GUI Elements . . 54   
    Naming GUI Components for Coding . . . 55   
    Connecting the GUI to Your Java Code . . 56

    Adding a Method to Check the Player’s Guess . . . . 58

    Getting Text from a JTextField . 59   
    Converting Strings to Numbers . . 60

    Starting a New Game 61   
    Listening for User Events: Click to Guess! 62   
    Setting Up the GUI Window . . . . . 64   
    Time to Play! . 66   
    Adding a Play Again Feature 66   
    Improving the UX . . 67

    Allowing Users to Press Enter to Guess . . 68   
    Automatically Removing Old Guesses . 68

    Handling Bad User Input . . 70   
    What You Learned . 73

    Programming Challenges . . . . 73

    #1: Showing Users How Many Tries They Took 73   
    #2: Showing and Hiding a Play Again Button . . . 73   
    #3: Creating a GUI MadLib . . 74

    # 4 Creating Your Fi rst Android A pp 75

    Starting a New Android Studio App Project . . . . . 76   
    Building the GUI Layout in Design View . . 80   
    Naming GUI Components in Android Studio . . 83   
    Connecting the GUI to Java in Android Studio . . 85   
    Adding Methods to Check the Guess and Begin a New Game . 88   
    Handling Events in Android . 91   
    Running the App on the Android Emulator . . 94   
    Running the App on a Real Android Device . . 100

    Preparing Your Device . . 100   
    Connecting Your Device . . . 101   
    Running the App on Your Device . . . 101

    Improving the UX . . . 102

    Centering the User’s Guess in the Text Field . 103   
    Adding a Listener for the Enter Key . . 103   
    Adding One More Finishing Touch . 104

    What You Learned . 105

    # Programming Challenges . . . . . . 105

    #1: “Toast”-ing to the Number of Tries . . . 106   
    #2: Adding Visual Appeal . . . 107   
    #3: Creating a MadLibs Mobile App . . . 107

    # 5 Poli shing Your App by Adding Menus and Preferences

    Adding an Options Menu in Android . . 109

    Adding Items to the Menu’s XML File . . 110   
    Displaying the Options Menu 111   
    Responding to User Selections . 112   
    Creating an Alert Dialog Pop-up for the About Screen . . 113

    Changing the Guessing Range . . . . 114

    Adding a Variable for the Range . . 115   
    Using the range Variable . . 115   
    Building the Dialog to Allow the User to Select the Range . . . . . 116

    Storing User Preferences and Game Stats . . . . . 118

    Storing and Retrieving the User’s Preferred Range . . . 118   
    Storing the Number of Games Won . . 120

    What You Learned . 122

    # Programming Challenges . . . . . . . . 122

    #1: You Win Some, You Lose Some . 122   
    #2: Ratio of Wins to Losses . . . 123

    # 6 Deciphering Secret Messages

    The Caesar Cipher . . . . 125

    Setting Up the Secret Messages App . . . . . 126

    Creating the Secret Messages Project in Eclipse . . 127   
    Beginning to Code SecretMessages.java . . . 128   
    Messing with Strings . . 128

    Characters and Values in Java . . 132

    Encoding Just the Letters 133

    Closing the Scanner . . . 135

    Adding a Custom Key Value . . . . . 137

    Encoding Digits . . 138

    Running Command Line Apps Without Eclipse . . . 141

    Finding Your Workspace Folders . 141   
    Opening a Command Line Window . . 142

    What You Learned . 144

    # Programming Challenges . . . . . . . 144

    #1: Looping the Loop 144   
    #2: Reversing and Encoding 145   
    #3: Safely Handling Keys with try and catch . . 145

    # 7 Creating Advanced GU Is and Sharing Your App 147

    Setting Up the Secret Messages GUI App Project . . . . 148

    Designing the GUI and Naming Components . . . . 148

    Coding the Secret Messages GUI App . . . . 152

    Creating the encode() Method 152

    Writing the Event Handler for the Encode/Decode Button . . . 154

    Handling Bad Input and User Errors . . . 156

    Building the main() Method and Running the App . . . . 156

    Improving the GUI . . . . 159

    Setting Line Wrap and Word Wrap . . . 161

    Handling Bad Input and User Errors: Part 2 . . 162

    Adding a Slider to the Secret Messages GUI . . 164

    Code Cracking with the Slider . . . . 166

    Bonus: Sharing Your App as a Runnable JAR File . . . . 169

    What You Learned . 172

    Programming Challenges . . . . . 172

    #1: Movin’ On Up! . . 172

    #2: Scrolling Away! 173

    #3: Changing the Text to Change the Slider . . . 174

    # 8 Make Secret Messages a Phone App to Share wi th Friends! 175

    Setting Up the Mobile GUI . 176

    Designing the Mobile GUI . . 177

    Wiring the GUI to the Java Code . . . . . 182

    Connecting the Encode Button to the encode() Method . . . 182

    Testing the App . . . . . . . . . . 185

    Working with the SeekBar . . . 187

    Running the App on the Emulator and on an Android Device . . . . . 188

    Bonus: Customizing the Floating Action Button . . 190

    Receiving Secret Messages from Other Apps . . . . . . 193

    What You Learned . 195

    Programming Challenges . . . . . . . 196

    #1: Creating a Move Up Button . . 196

    #2: Changing the SeekBar’s Progress . . 196

    # 9 Paint Col orful Bubbl es wi th Your Mouse! 197

    Creating the BubbleDraw Project Files . . . 198

    Building the BubbleDraw Frame . . . . 199

    Creating a Class for Bubbles . 200

    Defining a Bubble . . . . . . 200

    Designing a Bubble’s Methods . . 202

    Storing Bubbles in an ArrayList . . . . 205

    Adding a Constructor to the BubblePanel Class . . . . . 206

    Adding a Method to Draw on the Screen . . . 207

    Testing the BubblePanel Class . . . . . 208

    Handling Mouse Events from the User . . . . 210

    Creating a Reusable Event Listener . 211   
    Handling Clicks and Drags . . . . 212   
    Bonus: Handling MouseWheel Events . . 215

    What You Learned 218

    Programming Challenges . . . . . . . . 218

    #1: No Bubble Too Small . . 218   
    #2: PixelDraw! . . 219

    #

    # Adding Animation and Colli sion Detection wi th Ti mers 221

    Copying the BubbleDraw Java Project to Create BubbleDrawGUI . . . . 222

    Renaming the Main Class and Java File . . 222   
    Adding Transparency 224

    Adding Animation: Bubbles Rising! 225

    Adding a Timer . . . 226   
    Setting the Timer . . . . 226   
    Preparing the Animation 227   
    Starting the Timer . . . 229

    Forever Blowing Bubbles: Adding Random Speed and Direction . . 229

    Building a GUI for Our Animated Drawing App . . . . . . . 232

    Setting Up the GUI Panel and Buttons . 232   
    Coding the Clear and Pause/Start Buttons . . . 234

    Bouncing off the Walls with Collision Detection . 235

    A Soft Bounce . . 236   
    A Hard Bounce . . 238

    Adding a Slider to Control the Animation Speed . . . 240

    Customizing the Slider . . 241   
    Implementing the Slider Event Handler . . 242

    What You Learned . 243

    Programming Challenges . . . . . . . 244

    #1: No Bubble Left Behind . 244   
    #2: Flexi-Draw! . . 244   
    #3: PixelDraw 2.0 . 245

    #

    # Making Bubbl eDraw a Multitouch Android App 249

    Setting Up the BubbleDraw Project . . . . 250   
    Creating the BubbleView Constructor . 252

    Adding the Animation Variables 252   
    Creating the BubbleView() Constructor . . . 254   
    Preparing the Layout to Use BubbleView . . 254

    Modifying the Bubble Class . . . . . 255   
    Drawing in Android with the onDraw() Method . 257   
    Testing BubbleDraw with 100 Bubbles . . . . 258   
    Adding testBubbles() 258   
    Fixing the OnTouchListener Error . . . 259   
    Running the BubbleDraw App . . . . . 260

    Using Threaded Animation and Multitasking in Java . . . . 261

    Using Touch to Draw with Your Finger . . . . . 264

    Using Multitouch to Draw with 10 Fingers at a Time! . . . 266

    Testing Multitouch Events on an Android Device . . . . 266

    Changing the App Launcher Icon . . . . 268

    Creating a Custom App Icon . . . . 268

    Adding the Custom Icon to Your App . . . 268

    Displaying Your New Icon . . . 269

    Changing the App Name . . . 270

    What You Learned . 270

    Programming Challenges . . . 271

    #1: Combining One-Finger and Multitouch Events, v1.0 . . . . 271

    #2: Combining One-Finger and Multitouch Events, v2.0 . 271

    # Appendix

    # Debugging and Avoiding Common Errors in Java 273

    Spelling and Case . . . 274

    Correcting Typos in Eclipse . . . . 274

    Correcting Typos in Android Studio . . 275

    Avoiding Other Common Spelling Errors . . . . 276

    Comparison Trouble . . 276

    Grouping Symbols . . . . 276

    Quick Fixes in Eclipse . . 277

    Code Completion in Android Studio . . . 277

    Summary . . . . . 278
    """

    analyzer.parse_table_of_content(text_toc_string_java)

#     test_toc_string_python= """
# # Contents

# # 1 Why should you learn to write programs? 1

# 1.1 Creativity and motivation . . . 2   
# 1.2 Computer hardware architecture . . 3   
# 1.3 Understanding programming . . 4   
# 1.4 Words and sentences . 5   
# 1.5 Conversing with Python . . . 6   
# 1.6 Terminology: Interpreter and compiler . . . . 8   
# 1.7 Writing a program . . 10   
# 1.8 What is a program? 10   
# 1.9 The building blocks of programs . . . 11   
# 1.10 What could possibly go wrong? . . . . 12   
# 1.11 Debugging . . 14   
# 1.12 The learning journey . . . 15   
# 1.13 Glossary . . 15   
# 1.14 Exercises 16

# # 2 Variables, expressions, and statements 19

# 2.1 Values and types . . 19   
# 2.2 Variables 20   
# 2.3 Variable names and keywords . . . 21   
# 2.4 Statements 21   
# 2.5 Operators and operands . . 22   
# 2.6 Expressions . . . 23   
# 2.7 Order of operations . . 23   
# 2.8 Modulus operator . . 24   
# 2.9 String operations . . . 24

# 2.10 Asking the user for input . . . 25   
# 2.11 Comments 26   
# 2.12 Choosing mnemonic variable names . . 27   
# 2.13 Debugging . . 28   
# 2.14 Glossary . . 29   
# 2.15 Exercises 30

# # 3 Conditional execution 31

# 3.1 Boolean expressions 31   
# 3.2 Logical operators . . . 32   
# 3.3 Conditional execution . . 32   
# 3.4 Alternative execution 34   
# 3.5 Chained conditionals . . 34   
# 3.6 Nested conditionals . . 35   
# 3.7 Catching exceptions using try and except . . . . 36   
# 3.8 Short-circuit evaluation of logical expressions . . . 38   
# 3.9 Debugging . . 39   
# 3.10 Glossary . . 40   
# 3.11 Exercises 40

# # 4 Functions 43

# 4.1 Function calls . . . 43   
# 4.2 Built-in functions 43   
# 4.3 Type conversion functions . . . 44   
# 4.4 Math functions . . 45   
# 4.5 Random numbers 46   
# 4.6 Adding new functions . . 47   
# 4.7 Definitions and uses . . 48   
# 4.8 Flow of execution 49   
# 4.9 Parameters and arguments 49   
# 4.10 Fruitful functions and void functions . . 51   
# 4.11 Why functions? . 52   
# 4.12 Debugging . . 52   
# 4.13 Glossary . . 53   
# 4.14 Exercises 54

# # 5 Iteration 57

# 5.1 Updating variables . . . 57   
# 5.2 The while statement 57   
# 5.3 Infinite loops . . 58   
# 5.4 Finishing iterations with continue . . . 59   
# 5.5 Definite loops using for . . . . 60   
# 5.6 Loop patterns . . 61

# 5.6.1 Counting and summing loops . . . . 61   
# 5.6.2 Maximum and minimum loops . . . 62

# 5.7 Debugging . . 64

# 5.8 Glossary . . 64   
# 5.9 Exercises 64

# # 6 Strings 67

# 6.1 A string is a sequence . . 67   
# 6.2 Getting the length of a string using len . . . 68   
# 6.3 Traversal through a string with a loop . . . . 68   
# 6.4 String slices . . . 69   
# 6.5 Strings are immutable . . 70   
# 6.6 Looping and counting . . . 70   
# 6.7 The in operator . . . 71   
# 6.8 String comparison . . 71   
# 6.9 String methods . . 71   
# 6.10 Parsing strings . . . 74   
# 6.11 Formatted String Literals . . . 74   
# 6.12 Debugging 75   
# 6.13 Glossary . . 76   
# 6.14 Exercises 76

# # 7 Files 79

# 7.1 Persistence 79   
# 7.2 Opening files . . . . 79   
# 7.3 Text files and lines . . . 81   
# 7.4 Reading files . . . 82   
# 7.5 Searching through a file . . . . 83

# 7.6 Letting the user choose the file name . . . 85   
# 7.7 Using try, except, and open . . . . 86   
# 7.8 Writing files . . . 87   
# 7.9 Debugging . . 88   
# 7.10 Glossary . . 89   
# 7.11 Exercises 89

# # 8 Lists 91

# 8.1 A list is a sequence . . 91   
# 8.2 Lists are mutable . . 92   
# 8.3 Traversing a list . . 92   
# 8.4 List operations . . 93   
# 8.5 List slices 94   
# 8.6 List methods . . 94   
# 8.7 Deleting elements . . 95   
# 8.8 Lists and functions . . 96   
# 8.9 Lists and strings . . . 97   
# 8.10 Parsing lines . . 98   
# 8.11 Objects and values . . . 99   
# 8.12 Aliasing . . 100   
# 8.13 List arguments 100   
# 8.14 Debugging . . 102   
# 8.15 Glossary . . 105   
# 8.16 Exercises 105

# # 9 Dictionaries 109

# 9.1 Dictionary as a set of counters 111   
# 9.2 Dictionaries and files . . . 112   
# 9.3 Looping and dictionaries 114   
# 9.4 Advanced text parsing . . . 115   
# 9.5 Debugging . . 116   
# 9.6 Glossary . . 117   
# 9.7 Exercises 117

# # 10 Tuples 119

# 10.1 Tuples are immutable . . 119   
# 10.2 Comparing tuples . . . 120   
# 10.3 Tuple assignment . . 122   
# 10.4 Dictionaries and tuples . . 123   
# 10.5 Multiple assignment with dictionaries . . 124   
# 10.6 The most common words 125   
# 10.7 Using tuples as keys in dictionaries . . . 126   
# 10.8 Sequences: strings, lists, and tuples - Oh My! . . . . . 126   
# 10.9 List comprehension 127   
# 10.10 Debugging . . 128   
# 10.11 Glossary . . 128   
# 10.12 Exercises 128

# # 11 Regular expressions 131

# 11.1 Character matching in regular expressions . . . 132   
# 11.2 Extracting data using regular expressions . . 133   
# 11.3 Combining searching and extracting . . . 136   
# 11.4 Escape character . . 140   
# 11.5 Summary . . 140   
# 11.6 Bonus section for Unix / Linux users . . . 141   
# 11.7 Debugging . . 142   
# 11.8 Glossary . . . 142   
# 11.9 Exercises 143

# # 12 Networked programs 145

# 12.1 Hypertext Transfer Protocol - HTTP 145   
# 12.2 The world’s simplest web browser . . 146   
# 12.3 Retrieving an image over HTTP . . . 148   
# 12.4 Retrieving web pages with urllib . . . 150   
# 12.5 Reading binary files using urllib . . . 151   
# 12.6 Parsing HTML and scraping the web . . . 152   
# 12.7 Parsing HTML using regular expressions . . 152   
# 12.8 Parsing HTML using BeautifulSoup . . . 154   
# 12.9 Bonus section for Unix / Linux users . . . 157   
# 12.10 Glossary . . . 157   
# 12.11 Exercises 158

# # 13 Using Web Services 159

# 13.1 eXtensible Markup Language - XML . . . . 159   
# 13.2 Parsing XML . . 160   
# 13.3 Looping through nodes . . 161   
# 13.4 JavaScript Object Notation - JSON 162   
# 13.5 Parsing JSON . . . 163   
# 13.6 Application Programming Interfaces . . . 164   
# 13.7 Security and API usage . . . 165   
# 13.8 Glossary . . . 166

# # 14 Object-oriented programming 167

# 14.1 Managing larger programs . . 167   
# 14.2 Getting started . . 168   
# 14.3 Using objects . . . 168   
# 14.4 Starting with programs . . 169   
# 14.5 Subdividing a problem . . . 171   
# 14.6 Our first Python object . . . . 171   
# 14.7 Classes as types . . 174   
# 14.8 Object lifecycle . . . . 175   
# 14.9 Multiple instances 176   
# 14.10 Inheritance 177   
# 14.11 Summary . . 178   
# 14.12 Glossary . . . 179

# # 15 Using Databases and SQL 181

# 15.1 What is a database? 181   
# 15.2 Database concepts . . . 181   
# 15.3 Database Browser for SQLite . . . 182   
# 15.4 Creating a database table . . . 182   
# 15.5 Structured Query Language summary . . . 185   
# 15.6 Multiple tables and basic data modeling . . . . 187   
# 15.7 Data model diagrams . . 189   
# 15.8 Automatically creating primary keys . . . . 190   
# 15.9 Logical keys for fast lookup . . . 191   
# 15.10 Adding constraints to the database . . . 192

# 15.11 Sample multi-table application . . 193   
# 15.12 Many to many relationships in databases . . . 196   
# 15.13 Modeling data at the many-to-many connection 200   
# 15.14 Summary . . 201   
# 15.15 Debugging 202   
# 15.16 Glossary . . . 202

# # 16 Visualizing data 205

# 16.1 Building a OpenStreetMap from geocoded data . . . . 205   
# 16.2 Visualizing networks and interconnections . . 207   
# 16.3 Visualizing mail data 210

# # A Contributions 217

# A.1 Translations 217   
# A.2 Contributor List for Python for Everybody . . . . 217   
# A.3 Contributor List for Python for Informatics . . . 218   
# A.4 Preface for “Think Python” . . 218

# A.4.1 The strange history of “Think Python” 218   
# A.4.2 Acknowledgements for “Think Python” 219   
# A.5 Contributor List for “Think Python” . . . 220
# """

# analyzer.parse_table_of_content(test_toc_string_java)